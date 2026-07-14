import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { AttachmentMeta } from './document-repository';

// Injectable so the same code runs on expo-sqlite (prod) and better-sqlite3
// (tests). Any sync Drizzle SQLite db with our schema satisfies this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TxDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

/** +1 money IN, −1 money OUT. The sign of a movement lives HERE, never in `amount`. */
export type TxDirection = 1 | -1;

/** The two pockets. Each reconciles independently, so every row must name one. */
export type Account = 'cash' | 'instapay';

/** Why the money moved. Resolves `refId` (untyped polymorphic FK, house convention). */
export type TxRefKind = 'supplier' | 'expense' | 'sale' | 'owner' | 'transfer' | 'other';

export const CASH: Account = 'cash';
export const INSTAPAY: Account = 'instapay';

/** Every pocket the shop has. The cash book reports each one separately. */
export const ACCOUNTS: readonly Account[] = [CASH, INSTAPAY];

/**
 * One figure per pocket, plus their sum.
 *
 * `total` is a convenience, NEVER a substitute for the two: a single merged
 * number cannot be reconciled against anything, because there is nothing in the
 * world you can count that equals it. The drawer holds notes; InstaPay holds a
 * balance in an app. Each is checked on its own or not at all.
 */
export interface AccountTotals {
  cash: number;
  instapay: number;
  total: number;
}

export interface CreateTransactionInput {
  direction: TxDirection;
  /** Minor units, ALWAYS POSITIVE. A negative amount is a caller bug, not a refund. */
  amount: number;
  /** When the money MOVED — not when it was typed. The cash book follows this. */
  occurredAt: number;
  account: Account;
  refKind?: TxRefKind | null;
  refId?: string | null;
  /**
   * PROVENANCE, NOT ALLOCATION. Set ONLY by `documentRepository.create()`, on the
   * rows born with that document, so that deleting the document takes its money
   * rows with it. A payment made later from the سداد sheet leaves this NULL and
   * survives any invoice deletion — see schema.ts. The FIFO walk never reads it.
   */
  docId?: string | null;
  note?: string | null;
  /** PROOF OF MONEY (the InstaPay screenshot). Distinct from the document's proof of goods. */
  attachments?: AttachmentMeta[];
}

/** Thrown when a transaction would violate the sign/amount invariants. */
export class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}

function assertValid(input: CreateTransactionInput): void {
  if (!Number.isInteger(input.amount)) {
    throw new InvalidTransactionError(
      `amount must be an integer in minor units (got ${input.amount})`,
    );
  }
  // The sign lives in `direction`. Storing it in `amount` too would double-count
  // it in every SUM and silently invert half the cash book.
  if (input.amount <= 0) {
    throw new InvalidTransactionError(
      `amount must be positive — the sign belongs in \`direction\` (got ${input.amount})`,
    );
  }
  if (input.direction !== 1 && input.direction !== -1) {
    throw new InvalidTransactionError(`direction must be +1 or -1 (got ${input.direction})`);
  }
}

/**
 * Insert one cash-book row WITHOUT opening a transaction of its own.
 *
 * This is the whole reason the function exists. `documentRepository.create()`
 * already wraps its work in `db.transaction()`, and expo-sqlite's sync driver
 * CANNOT NEST TRANSACTIONS — a `BEGIN` inside a `BEGIN` throws "Failed to run
 * the query 'begin'". So the purchase payment must be written by *this*
 * function, from inside that existing transaction, which is also what makes a
 * failed payment roll the document and its lines back with it.
 *
 * Callers that are NOT already inside a transaction should use
 * `transactionRepository.create()`, which wraps this.
 */
export function insertTransactionRow(
  db: TxDb,
  input: CreateTransactionInput,
  clock: () => number = now,
): string {
  assertValid(input);
  const ts = clock();
  const id = newId();
  db.insert(schema.transactions)
    .values({
      id,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      direction: input.direction,
      amount: input.amount,
      occurredAt: input.occurredAt,
      account: input.account,
      refKind: input.refKind ?? null,
      refId: input.refId ?? null,
      docId: input.docId ?? null,
      note: input.note ?? null,
      attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null,
    })
    .run();
  return id;
}

/**
 * Soft-delete every cash-book row BORN WITH one document.
 *
 * Like `insertTransactionRow`, this opens NO transaction of its own: it is called
 * from inside `documentRepository.remove()`'s existing `db.transaction()`, and
 * expo-sqlite's sync driver cannot nest a `BEGIN` inside a `BEGIN`. The document
 * and its money must die in ONE atomic step or the failure mode is exactly the
 * one this whole change exists to kill: an invoice gone, its payment still
 * counted, and `owed(supplier)` NEGATIVE.
 *
 * It matches on `doc_id`, so it can only ever reach rows this document created.
 * A standalone سداد payment (doc_id NULL) points at the SUPPLIER and is left
 * alone — that money really did move, and no deletion can un-move it.
 */
export function archiveTransactionsForDocument(
  db: TxDb,
  docId: string,
  clock: () => number = now,
): void {
  const ts = clock();
  db.update(schema.transactions)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(schema.transactions.docId, docId), isNull(schema.transactions.deletedAt)))
    .run();
}

/**
 * Σ(direction × amount) — the ONLY correct way to add cash-book rows together.
 * `amount` is a magnitude; adding magnitudes together silently merges money that
 * came IN with money that went OUT.
 */
export const NET_AMOUNT_SQL = sql<number>`coalesce(sum(${schema.transactions.direction} * ${schema.transactions.amount}), 0)`;

/**
 * Σ(−direction × amount) — what the shop has NET HANDED OVER to a ref.
 *
 * The "paid" side of every debt subtraction, and the reason it is signed: a −1
 * row is a payment and pays the debt DOWN; a +1 row against the same ref is
 * money coming BACK (a refund, a returned crate) and pushes the debt back UP.
 * Summing |amount| would have a refund PAY OFF the debt it should re-create.
 * Shared by debt-repository and expense-repository, which derive the same
 * subtraction over two different kinds of obligation.
 */
export const SETTLED_AMOUNT_SQL = sql<number>`coalesce(sum(-${schema.transactions.direction} * ${schema.transactions.amount}), 0)`;

/** Fold a grouped-by-account SQL result into a figure per pocket, plus the sum. */
function totalsFrom(rows: { account: string; total: number }[]): AccountTotals {
  const cash = rows.find((r) => r.account === CASH)?.total ?? 0;
  const instapay = rows.find((r) => r.account === INSTAPAY)?.total ?? 0;
  return { cash, instapay, total: cash + instapay };
}

export function createTransactionRepository(db: TxDb, clock: () => number = now) {
  const live = isNull(schema.transactions.deletedAt);

  const api = {
    /** Record one money movement. Standalone — opens its own db transaction. */
    create(input: CreateTransactionInput): string {
      return db.transaction(() => insertTransactionRow(db, input, clock));
    },

    /**
     * Record several movements ATOMICALLY — all of them or none. A payment split
     * across pockets (part cash, part InstaPay) is two rows that must never land
     * half-written, and a drawer↔InstaPay transfer is two rows that must never
     * net to anything but zero.
     */
    createMany(inputs: CreateTransactionInput[]): string[] {
      return db.transaction(() => inputs.map((i) => insertTransactionRow(db, i, clock)));
    },

    /**
     * NET movement against one ref: Σ(direction × amount). SIGNED, deliberately.
     *
     * Positive ⇒ money came IN against it (a sale). Negative ⇒ money went OUT
     * (a supplier payment). The sign is READ from the rows, never assumed by the
     * caller — the old `sumByRef` summed |amount| and so could not tell a payment
     * from a refund. Nothing writes a +1 supplier row today; the day something
     * does (a return credit from Ahmed), every figure derived from this one has
     * to move in the right direction on its own.
     */
    netByRef(refKind: TxRefKind, refId: string): number {
      const row = db
        .select({ total: NET_AMOUNT_SQL })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.refKind, refKind),
            eq(schema.transactions.refId, refId),
            live,
          ),
        )
        .get();
      return row?.total ?? 0;
    },

    /**
     * What the shop has NET HANDED OVER to one ref — the "paid" side of every
     * debt subtraction (`owed = invoiced − settled`).
     *
     * It is exactly `−netByRef`: money OUT (−1) counts as paid, and money IN
     * against the same ref (+1 — a refund, a returned crate) counts AGAINST it,
     * pushing the debt back UP. That is the whole reason it is not a Σ|amount|.
     */
    settledByRef(refKind: TxRefKind, refId: string): number {
      const net = api.netByRef(refKind, refId);
      // `-0` is not `0` to Object.is (nor to a strict test), and it renders as
      // "-0" the moment anything stringifies it. Negating zero must give zero.
      return net === 0 ? 0 : -net;
    },

    /** Every movement pointing at one ref, oldest first (a payment history). */
    listByRef(refKind: TxRefKind, refId: string) {
      return db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.refKind, refKind),
            eq(schema.transactions.refId, refId),
            live,
          ),
        )
        .orderBy(schema.transactions.occurredAt)
        .all();
    },

    /**
     * Cash on hand in one pocket: Σ(direction × amount).
     *
     * NOTE the total ABSENCE of a sentinel filter. Debt hides the walk-in
     * sentinel; cash hides NOTHING. A walk-in purchase really did empty the
     * drawer, and a cash book with a hole in it is worse than no cash book —
     * the day its figure stops matching the physical drawer is the day the
     * owner stops trusting the app.
     */
    cashByAccount(account: Account): number {
      const row = db
        .select({
          total: sql<number>`coalesce(sum(${schema.transactions.direction} * ${schema.transactions.amount}), 0)`,
        })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.account, account), live))
        .get();
      return row?.total ?? 0;
    },

    /**
     * Both pockets at once — cash, InstaPay, and their sum.
     *
     * The reconciliation invariant (TC-7.3) in one call: each figure IS
     * Σ(direction × amount) over that account's live rows, computed from the
     * rows every time and cached NOWHERE. A stored balance is a number that can
     * disagree with the ledger; a derived one cannot, because it *is* the ledger.
     */
    balances(): AccountTotals {
      const cash = api.cashByAccount(CASH);
      const instapay = api.cashByAccount(INSTAPAY);
      return { cash, instapay, total: cash + instapay };
    },

    /**
     * WHAT THE SHOP SOLD in a window, split by the pocket the money landed in.
     * `[fromMs, toMs)` — half-open, so consecutive days can never double-count.
     *
     * Summed from `transactions`, filtered on `occurred_at` and `ref_kind='sale'`
     * — NEVER from `documents`, which has no `account` column and therefore
     * physically cannot answer "cash or InstaPay" (NFR12). It also could not
     * answer it for a split-paid sale even in principle: one document, two
     * pockets, and the split lives only here.
     *
     * `ref_kind='sale'` is what keeps this a SALES figure and not a cash-flow
     * one: a 4000 cash payment handed to a supplier on the same day moves the
     * drawer but sells nothing, and must not appear here.
     */
    salesBetween(fromMs: number, toMs: number): AccountTotals {
      const rows = db
        .select({
          account: schema.transactions.account,
          total: sql<number>`coalesce(sum(${schema.transactions.amount}), 0)`,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.refKind, 'sale'),
            // Money IN only. A refund (were one ever recorded against a sale)
            // is not a sale, and must not inflate the day's takings.
            eq(schema.transactions.direction, 1),
            gte(schema.transactions.occurredAt, fromMs),
            lt(schema.transactions.occurredAt, toMs),
            live,
          ),
        )
        .groupBy(schema.transactions.account)
        .all();
      return totalsFrom(rows);
    },

    /**
     * NET movement per pocket in a window: Σ(direction × amount), every ref kind.
     *
     * A different question from `salesBetween` and deliberately not fused with
     * it — the day's takings and the day's change in the drawer are not the same
     * number, and a screen that shows one as the other is lying about both.
     */
    netBetween(fromMs: number, toMs: number): AccountTotals {
      const rows = db
        .select({
          account: schema.transactions.account,
          total: sql<number>`coalesce(sum(${schema.transactions.direction} * ${schema.transactions.amount}), 0)`,
        })
        .from(schema.transactions)
        .where(
          and(
            gte(schema.transactions.occurredAt, fromMs),
            lt(schema.transactions.occurredAt, toMs),
            live,
          ),
        )
        .groupBy(schema.transactions.account)
        .all();
      return totalsFrom(rows);
    },

    /** The cash book itself: every live movement, most recent money first. */
    listForCashBook() {
      return db
        .select()
        .from(schema.transactions)
        .where(live)
        .orderBy(desc(schema.transactions.occurredAt), desc(schema.transactions.createdAt))
        .all();
    },

    /** Soft-delete a movement; it vanishes from debt, cash and the ledger alike. */
    archive(id: string): void {
      const ts = clock();
      db.update(schema.transactions)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(eq(schema.transactions.id, id))
        .run();
    },

    /**
     * Soft-delete SEVERAL movements ATOMICALLY — all of them or none.
     *
     * This exists for the TRANSFER, which is a PAIR of rows (out of one pocket,
     * into the other). Deleting one leg alone would leave an orphan half: the
     * drawer would have lost 5,000 that arrived nowhere, and the two pockets
     * would never balance again. `createMany` writes the pair in one step for
     * exactly this reason, and it can only be un-written the same way.
     */
    archiveMany(ids: string[]): void {
      if (ids.length === 0) return;
      db.transaction(() => {
        for (const id of ids) api.archive(id);
      });
    },
  };

  return api;
}

/** One live row of the cash book, as the ledger reads it. */
export type TransactionRow = ReturnType<TransactionRepository['listForCashBook']>[number];

export type TransactionRepository = ReturnType<typeof createTransactionRepository>;
