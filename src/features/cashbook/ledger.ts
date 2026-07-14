import type { AttachmentMeta } from '@/repositories/document-repository';
import type {
  Account,
  TransactionRow,
  TxDirection,
} from '@/repositories/transaction-repository';
import { startOfDay } from '@/utils/dates';
import type { LedgerDay, LedgerEntry, LedgerKind } from './types';

const KINDS: LedgerKind[] = ['supplier', 'expense', 'sale', 'owner', 'transfer', 'other'];

/**
 * A row the app cannot explain is still money that MOVED. It reads as
 * `'unknown'` rather than being dropped — a ledger that hides rows it does not
 * understand is a ledger with a hole, and its balance stops matching the drawer.
 */
function kindOf(refKind: string | null): LedgerKind {
  return KINDS.includes(refKind as LedgerKind) ? (refKind as LedgerKind) : 'unknown';
}

function parseAttachments(raw: string | null): AttachmentMeta[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttachmentMeta[]) : [];
  } catch {
    return [];
  }
}

function entryFrom(row: TransactionRow): LedgerEntry {
  return {
    id: row.id,
    // A lone row stands for itself — including an ORPHAN transfer leg, which has
    // no partner to take with it.
    pairedId: null,
    kind: kindOf(row.refKind),
    occurredAt: row.occurredAt,
    amount: row.amount,
    direction: row.direction as TxDirection,
    account: row.account as Account,
    toAccount: null,
    refId: row.refId,
    note: row.note,
    attachments: parseAttachments(row.attachments),
  };
}

/** The OUT leg and the IN leg of one transfer, folded into a single entry. */
function transferFrom(out: TransactionRow, into: TransactionRow): LedgerEntry {
  return {
    id: out.id,
    // Both legs, carried on the entry that folded them — so that deleting the
    // transfer can delete the whole of it (`legIdsOf`).
    pairedId: into.id,
    kind: 'transfer',
    occurredAt: out.occurredAt,
    amount: out.amount,
    // No sign: a transfer is neither income nor expense. Give it one and every
    // transfer reads as a loss.
    direction: null,
    account: out.account as Account,
    toAccount: into.account as Account,
    refId: out.refId,
    note: out.note ?? into.note,
    // The proof rides on the InstaPay leg, wherever that is.
    attachments: [...parseAttachments(out.attachments), ...parseAttachments(into.attachments)],
  };
}

/**
 * Fold the raw rows into ledger entries, PAIRING each transfer's two legs.
 *
 * The two legs are written together (`createMany`) with the same `occurred_at`
 * and the same amount, so they pair on exactly that: same instant, same amount,
 * opposite direction. Two identical transfers in the same millisecond pair into
 * two transfers, which is the right answer. A leg with no partner (a half-written
 * transfer that no code path can currently produce) still renders — as an
 * ordinary movement, because the money still moved.
 */
export function toLedgerEntries(rows: TransactionRow[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const pendingOut = new Map<string, TransactionRow[]>();
  const pendingIn = new Map<string, TransactionRow[]>();
  const key = (r: TransactionRow) => `${r.occurredAt}|${r.amount}`;

  const take = (bucket: Map<string, TransactionRow[]>, k: string): TransactionRow | undefined => {
    const queue = bucket.get(k);
    if (!queue?.length) return undefined;
    return queue.shift();
  };
  const park = (bucket: Map<string, TransactionRow[]>, k: string, row: TransactionRow) => {
    const queue = bucket.get(k);
    if (queue) queue.push(row);
    else bucket.set(k, [row]);
  };

  for (const row of rows) {
    if (kindOf(row.refKind) !== 'transfer') {
      entries.push(entryFrom(row));
      continue;
    }
    const k = key(row);
    if (row.direction === -1) {
      const partner = take(pendingIn, k);
      if (partner) entries.push(transferFrom(row, partner));
      else park(pendingOut, k, row);
    } else {
      const partner = take(pendingOut, k);
      if (partner) entries.push(transferFrom(partner, row));
      else park(pendingIn, k, row);
    }
  }

  // Orphan legs: no partner, but the money moved all the same.
  for (const queue of [...pendingOut.values(), ...pendingIn.values()]) {
    for (const row of queue) entries.push(entryFrom(row));
  }

  return entries.sort((a, b) => b.occurredAt - a.occurredAt);
}

/**
 * EVERY `transactions` ROW ONE ENTRY STANDS FOR — a transfer is TWO, everything
 * else is one.
 *
 * The unit the owner sees is the unit he deletes. He long-presses ONE row that
 * says "من النقدي إلى إنستاباي" and expects that transfer to be gone; archiving
 * only the leg he happened to touch would leave the other half behind, money
 * that left a pocket it never left and arrived in one it never reached. The
 * pairing is `toLedgerEntries`' answer, read straight off the entry — never
 * re-derived by a caller, which is how the two could drift apart.
 */
export function legIdsOf(entry: LedgerEntry): string[] {
  return entry.pairedId ? [entry.id, entry.pairedId] : [entry.id];
}

/**
 * The cash book: entries grouped into days, newest day first.
 *
 * Days are bucketed in the shop's LOCAL timezone (Egypt), NEVER UTC — a 23:30
 * sale must land on the day the owner sold it, not the next one.
 *
 * The per-day nets are summed from the RAW rows (both legs of every transfer),
 * not from the folded entries: the drawer really did lose 5000 and InstaPay
 * really did gain it, and the day's two pockets must each be reconcilable.
 */
export function toLedgerDays(rows: TransactionRow[]): LedgerDay[] {
  const byDay = new Map<number, TransactionRow[]>();
  for (const row of rows) {
    const k = startOfDay(row.occurredAt);
    const bucket = byDay.get(k);
    if (bucket) bucket.push(row);
    else byDay.set(k, [row]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b - a)
    .map(([key, dayRows]) => {
      const net = (account: Account) =>
        dayRows
          .filter((r) => r.account === account)
          .reduce((sum, r) => sum + r.direction * r.amount, 0);
      return {
        key,
        entries: toLedgerEntries(dayRows),
        netCash: net('cash'),
        netInstapay: net('instapay'),
      };
    });
}
