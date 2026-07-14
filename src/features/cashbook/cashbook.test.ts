import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_CUSTOMER_ID } from '@/db/sentinels';
import { createDocumentRepository } from '@/repositories/document-repository';
import {
  createTransactionRepository,
  type Account,
} from '@/repositories/transaction-repository';
import { createSupplierRepository } from '@/repositories/supplier-repository';
import { createDebtRepository } from '@/repositories/debt-repository';
import { endOfDay, startOfDay } from '@/utils/dates';
import { toLedgerDays, toLedgerEntries } from './ledger';

// Fixed clock, never Date.now(). Built from LOCAL calendar parts on purpose:
// the shop is in Egypt and its day starts when the shop opens, not when UTC
// says so. A UTC-bucketed test would pass on a UTC machine and lie in Cairo.
const D = new Date(2026, 6, 12, 10, 0, 0).getTime(); // Sun 12 Jul 2026, 10:00 local
const DAY = 86_400_000;
const T0 = 1_760_000_000_000;

let db: TestDb;
let txs: ReturnType<typeof createTransactionRepository>;
let docs: ReturnType<typeof createDocumentRepository>;
let suppliers: ReturnType<typeof createSupplierRepository>;
let debts: ReturnType<typeof createDebtRepository>;

beforeEach(() => {
  db = makeTestDb();
  txs = createTransactionRepository(db, () => T0);
  docs = createDocumentRepository(db);
  suppliers = createSupplierRepository(db, () => T0);
  debts = createDebtRepository(db, () => T0);
  seedSentinels(db, T0);
  stock(1000); // goods to sell, bought for nothing: no money moved, no cash-book row
});

/** Put goods on the shelf WITHOUT touching the cash book (no payments at all). */
function stock(qty: number): void {
  docs.create({
    kind: 'incoming',
    status: 'posted',
    docDate: T0,
    lines: [{ itemId: 'X', qty, unitPrice: 0 }],
  });
}

/** Post a sale, paid across one pocket or both. Returns the document id. */
function sale(
  parts: { amount: number; account: Account; occurredAt?: number }[],
  at: number = D,
): string {
  const total = parts.reduce((sum, p) => sum + p.amount, 0);
  return docs.create({
    kind: 'outgoing',
    status: 'posted',
    partyId: WALKIN_CUSTOMER_ID,
    docDate: at,
    lines: [{ itemId: 'X', qty: 1, unitPrice: total }],
    payments: parts.map((p) => ({
      amount: p.amount,
      account: p.account,
      occurredAt: p.occurredAt ?? at,
    })),
  });
}

/** Today's sales, bucketed in the shop's LOCAL timezone. */
const salesOn = (day: number) => txs.salesBetween(startOfDay(day), endOfDay(day));
const netOn = (day: number) => txs.netBetween(startOfDay(day), endOfDay(day));

describe('TC-6 — "how much did I sell today, cash versus InstaPay?"', () => {
  it('TC-6.1: splits the day by the pocket the money landed in', () => {
    sale([{ amount: 10000, account: 'cash' }]);
    sale([{ amount: 7000, account: 'instapay' }]);
    sale([{ amount: 3000, account: 'cash' }]);

    const today = salesOn(D);
    expect(today.cash).toBe(13000);
    expect(today.instapay).toBe(7000);
    expect(today.total).toBe(20000);

    // The figure is summed from TRANSACTIONS, filtered on `occurred_at`. It
    // could not have come from `documents`: that table has no `account` column
    // and therefore physically cannot answer "which pocket" (NFR12).
    expect(docs.list({ kind: 'outgoing' })).toHaveLength(3);
  });

  it('TC-6.2: a supplier payment on the same day is NOT a sale', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    sale([{ amount: 10000, account: 'cash' }]);
    txs.create({
      direction: -1,
      amount: 4000,
      occurredAt: D,
      account: 'cash',
      refKind: 'supplier',
      refId: ahmed,
    });

    // Sales and cash-flow are DIFFERENT QUESTIONS, and this is what stops them
    // being fused: the day's takings are 10000, while the drawer only grew by
    // 6000. A screen that reported one as the other would be lying about both.
    expect(salesOn(D).cash).toBe(10000);
    expect(netOn(D).cash).toBe(6000);
  });

  it('TC-6.3: day boundaries fall in the shop LOCAL timezone, never UTC', () => {
    const lateOnD = new Date(2026, 6, 12, 23, 59, 59).getTime();
    const earlyOnNext = new Date(2026, 6, 13, 0, 0, 1).getTime();

    sale([{ amount: 5000, account: 'cash' }], lateOnD);
    sale([{ amount: 800, account: 'cash' }], earlyOnNext);

    // Two seconds apart, two different days — because the shop's day ends at its
    // own midnight. Bucket these by UTC in Cairo and the late sale jumps into
    // tomorrow, and the owner's closing count is short by exactly 5000.
    expect(salesOn(lateOnD).cash).toBe(5000);
    expect(salesOn(earlyOnNext).cash).toBe(800);
    expect(salesOn(lateOnD).total + salesOn(earlyOnNext).total).toBe(5800);
  });

  it('TC-6.4 / TC-4.3: a split-paid sale lands in BOTH buckets, counted once in each', () => {
    const docId = sale([
      { amount: 5000, account: 'cash' },
      { amount: 5000, account: 'instapay' },
    ]);

    expect(salesOn(D).cash).toBe(5000);
    expect(salesOn(D).instapay).toBe(5000);
    expect(salesOn(D).total).toBe(10000);

    // ONE sale, TWO rows, one document. This is the case no `documents`-based
    // report could ever get right: the split exists only in the transactions.
    const rows = txs.listByRef('sale', docId);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.refKind === 'sale' && r.refId === docId)).toBe(true);

    // TC-3.2 still holds: 5000 + 5000 === the document total. Read SIGNED, so a
    // refund could never pose here as a second payment.
    expect(txs.netByRef('sale', docId)).toBe(10000);
  });

  it('TC-6.5: the cash book follows the MONEY (occurred_at), not the paperwork (doc_date)', () => {
    // A sale papered on day D whose money actually arrived on D+1.
    sale([{ amount: 4000, account: 'cash', occurredAt: D + DAY }], D);

    expect(salesOn(D).cash).toBe(0);
    expect(salesOn(D + DAY).cash).toBe(4000);
  });

  // The DOCUMENT is deleted here, not the transaction. Archiving the transaction
  // by hand tests nothing the app can do: no screen offers it. What the owner
  // taps is "delete this sale" — and if that leaves the ref_kind='sale' row
  // alive, the drawer still claims the 10000 he never took.
  it('TC-7.4: a soft-deleted sale vanishes from the daily split AND the balance', () => {
    const docId = sale([{ amount: 10000, account: 'cash' }]);
    expect(salesOn(D).cash).toBe(10000);

    docs.remove(docId);

    expect(salesOn(D).cash).toBe(0);
    expect(netOn(D).cash).toBe(0);
    expect(txs.balances()).toEqual({ cash: 0, instapay: 0, total: 0 });
    expect(txs.listForCashBook()).toHaveLength(0);
    expect(txs.listByRef('sale', docId)).toEqual([]);
    expect(docs.list({ kind: 'outgoing' })).toEqual([]);
  });

  it('TC-7.4: deleting a SPLIT-paid sale takes BOTH of its rows with it', () => {
    const docId = sale([
      { amount: 5000, account: 'cash' },
      { amount: 5000, account: 'instapay' },
    ]);
    expect(txs.listByRef('sale', docId)).toHaveLength(2);

    docs.remove(docId);

    // Cascading only the first row would leave 5000 of phantom InstaPay in a
    // pocket the owner reconciles against a real app balance.
    expect(txs.balances()).toEqual({ cash: 0, instapay: 0, total: 0 });
    expect(salesOn(D).total).toBe(0);
  });

  it('TC-7.4: deleting one sale leaves every OTHER sale untouched', () => {
    const kept = sale([{ amount: 3000, account: 'cash' }]);
    const doomed = sale([{ amount: 10000, account: 'cash' }]);

    docs.remove(doomed);

    expect(salesOn(D).cash).toBe(3000);
    expect(txs.listByRef('sale', kept)).toHaveLength(1);
  });
});

describe('TC-7.1 — the owner takes 2000 for himself', () => {
  it('empties the drawer by 2000 and changes NO supplier debt', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    docs.create({
      kind: 'incoming',
      status: 'posted',
      partyId: ahmed,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 6000 }], // unpaid: 6000 of debt
    });
    sale([{ amount: 10000, account: 'cash' }]);

    txs.create({
      direction: -1,
      amount: 2000,
      occurredAt: D,
      account: 'cash',
      refKind: 'owner',
      refId: null, // an owner drawing points at NOBODY
    });

    expect(txs.balances().cash).toBe(8000);
    // He owes Ahmed exactly what he owed before lunch. A drawing is not a debt,
    // and the day these two get tangled is the day both numbers become useless.
    expect(debts.owed(ahmed)).toBe(6000);
    // And it is not a sale either — the takings are untouched.
    expect(salesOn(D).cash).toBe(10000);
  });
});

describe('the ledger — one book, every movement, and a transfer that reads as one thing', () => {
  it('TC-7.2: renders a transfer as ONE entry, not two unrelated movements', () => {
    txs.createMany([
      { direction: -1, amount: 5000, occurredAt: D, account: 'cash', refKind: 'transfer' },
      { direction: 1, amount: 5000, occurredAt: D, account: 'instapay', refKind: 'transfer' },
    ]);

    const entries = toLedgerEntries(txs.listForCashBook());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'transfer',
      amount: 5000,
      account: 'cash',
      toAccount: 'instapay',
      // NO SIGN. A transfer is neither income nor expense — give it one and every
      // transfer the owner ever makes reads to him as a loss.
      direction: null,
    });

    // The two pockets each moved; the shop's money did not.
    const balances = txs.balances();
    expect(balances.cash).toBe(-5000);
    expect(balances.instapay).toBe(5000);
    expect(balances.total).toBe(0);
  });

  it('groups by LOCAL day, newest first, and reports what each pocket did', () => {
    sale([{ amount: 10000, account: 'cash' }], D);
    sale([{ amount: 7000, account: 'instapay' }], D);
    txs.create({
      direction: -1,
      amount: 2000,
      occurredAt: D + DAY,
      account: 'cash',
      refKind: 'owner',
    });

    const days = toLedgerDays(txs.listForCashBook());
    expect(days).toHaveLength(2);

    expect(days[0].key).toBe(startOfDay(D + DAY)); // newest day first
    expect(days[0].entries).toHaveLength(1);
    expect(days[0].netCash).toBe(-2000);

    expect(days[1].key).toBe(startOfDay(D));
    expect(days[1].entries.map((e) => e.kind)).toEqual(['sale', 'sale']);
    expect(days[1].netCash).toBe(10000);
    expect(days[1].netInstapay).toBe(7000);
  });

  it("keeps a movement whose ref_kind it cannot explain — a ledger's hole is worse than an odd row", () => {
    txs.create({ direction: -1, amount: 500, occurredAt: D, account: 'cash', refKind: null });

    const [entry] = toLedgerEntries(txs.listForCashBook());
    expect(entry.kind).toBe('unknown');
    expect(entry.amount).toBe(500);
    // The money left the drawer whether or not the app can say why.
    expect(txs.balances().cash).toBe(-500);
  });

  it('pairs each transfer with its OWN partner when two happen the same day', () => {
    txs.createMany([
      { direction: -1, amount: 5000, occurredAt: D, account: 'cash', refKind: 'transfer' },
      { direction: 1, amount: 5000, occurredAt: D, account: 'instapay', refKind: 'transfer' },
    ]);
    txs.createMany([
      { direction: -1, amount: 800, occurredAt: D + 60_000, account: 'instapay', refKind: 'transfer' },
      { direction: 1, amount: 800, occurredAt: D + 60_000, account: 'cash', refKind: 'transfer' },
    ]);

    const entries = toLedgerEntries(txs.listForCashBook());
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => ({ amount: e.amount, from: e.account, to: e.toAccount }))).toEqual([
      { amount: 800, from: 'instapay', to: 'cash' }, // newest first
      { amount: 5000, from: 'cash', to: 'instapay' },
    ]);
  });
});
