import { and, desc, eq, isNull, sql } from 'drizzle-orm';
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

export interface CreateTransactionInput {
  direction: TxDirection;
  /** Minor units, ALWAYS POSITIVE. A negative amount is a caller bug, not a refund. */
  amount: number;
  /** When the money MOVED — not when it was typed. The cash book follows this. */
  occurredAt: number;
  account: Account;
  refKind?: TxRefKind | null;
  refId?: string | null;
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
      note: input.note ?? null,
      attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null,
    })
    .run();
  return id;
}

export function createTransactionRepository(db: TxDb, clock: () => number = now) {
  const live = isNull(schema.transactions.deletedAt);

  return {
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

    /** Σ amount pointing at one ref. Positive; the caller knows the direction. */
    sumByRef(refKind: TxRefKind, refId: string): number {
      const row = db
        .select({ total: sql<number>`coalesce(sum(${schema.transactions.amount}), 0)` })
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
  };
}

export type TransactionRepository = ReturnType<typeof createTransactionRepository>;
