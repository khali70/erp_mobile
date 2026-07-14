import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { AttachmentMeta } from './document-repository';
import { EXPENSE_SETTLING_KINDS, SETTLED_AMOUNT_SQL } from './transaction-repository';

// Injectable so the same code runs on expo-sqlite (prod) and better-sqlite3
// (tests). Any sync Drizzle SQLite db with our schema satisfies it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExpenseDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

/** The shop's expense buckets. Stored as free text; the UI offers these five. */
export type ExpenseCategory = 'rent' | 'salaries' | 'utilities' | 'transport' | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent',
  'salaries',
  'utilities',
  'transport',
  'other',
];

export interface CreateExpenseInput {
  title: string;
  category?: ExpenseCategory | null;
  /** MINOR units (piasters), integer, positive. 200 ج.م → 20000. */
  totalAmount: number;
  /** When the obligation arose (epoch ms). Defaults to the injected clock. */
  incurredAt?: number;
  /** FREE TEXT — the landlord. Deliberately not a supplier FK. */
  partyName?: string | null;
  note?: string | null;
  /** The bill / receipt photo. */
  attachments?: AttachmentMeta[];
}

/** One expense, as it comes back out of the table. Money = minor units. */
export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory | null;
  totalAmount: number;
  incurredAt: number;
  partyName: string | null;
  note: string | null;
  attachments: AttachmentMeta[];
  createdAt: number;
}

/**
 * An expense WITH its derived debt. `remaining` is the whole point of the table:
 * it is computed, never stored.
 */
export interface ExpenseDebt extends Expense {
  /** Σ live transactions pointing at this expense. */
  paid: number;
  /** total − paid. NEGATIVE when over-paid — never clamped (see `owed`). */
  remaining: number;
  /** `paid` ⇒ nothing left owing (includes an over-payment). */
  status: 'paid' | 'partial' | 'unpaid';
}

/** Thrown when an expense would carry a nonsensical amount. */
export class InvalidExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidExpenseError';
  }
}

function assertValid(input: CreateExpenseInput): void {
  if (!input.title.trim()) {
    throw new InvalidExpenseError('an expense must say what it was for (title is required)');
  }
  // Money is INTEGER minor units, everywhere, always. A float here would round a
  // piastre out of existence inside a figure the owner reconciles against cash.
  if (!Number.isInteger(input.totalAmount)) {
    throw new InvalidExpenseError(
      `totalAmount must be an integer in minor units (got ${input.totalAmount})`,
    );
  }
  if (input.totalAmount <= 0) {
    throw new InvalidExpenseError(`totalAmount must be positive (got ${input.totalAmount})`);
  }
}

function parseAttachments(raw: string | null): AttachmentMeta[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttachmentMeta[]) : [];
  } catch {
    return [];
  }
}

/**
 * EXPENSES — and their DERIVED debt.
 *
 * RENT IS DEBT TOO. This is the insight the whole epic turns on: debt does not
 * come from purchase invoices, it comes from OBLIGATIONS, and a purchase invoice
 * is merely one thing that creates one. Rent creates one with no goods, no lines
 * and no document — and until this table existed, the owner's payables KPI was
 * quietly lying to him, counting suppliers and nothing else.
 *
 *   owed(E) = expenses.total_amount
 *           − Σ (−direction × transactions.amount)  WHERE ref_kind IN ('expense','opening')
 *                                                     AND ref_id=E AND deleted_at IS NULL
 *
 * The payment side is SIGNED (see SETTLED_AMOUNT_SQL): money out settles the
 * bill, money back in against it un-settles it.
 *
 * That is character-for-character the supplier rule (see debt-repository), which
 * is why paying the rent reuses the supplier's سداد sheet unchanged: same ref,
 * same single cash-book row, no fork.
 *
 * There is NO `paid` column, NO settled flag and NO cached balance — deliberately.
 * A stored figure is a second answer to a question the transactions already
 * answer, and the day the two disagree the owner cannot tell which is lying. A
 * derived number cannot disagree with the payments, because it IS the payments.
 *
 * `clock` is INJECTED — never `Date.now()` in a repository, or the tests flake.
 */
export function createExpenseRepository(db: ExpenseDb, clock: () => number = now) {
  const live = isNull(schema.expenses.deletedAt);

  function toExpense(r: schema.ExpenseRow): Expense {
    return {
      id: r.id,
      title: r.title,
      category: (r.category as ExpenseCategory | null) ?? null,
      totalAmount: r.totalAmount,
      incurredAt: r.incurredAt,
      partyName: r.partyName,
      note: r.note,
      attachments: parseAttachments(r.attachments),
      createdAt: r.createdAt,
    };
  }

  /**
   * NET payments per expense, in ONE query — so a list of N expenses costs 2
   * queries, not 2N. Soft-deleted payments paid nothing and are excluded here,
   * which is half of why every figure in this file is safe.
   *
   * The sum is SIGNED — Σ(−direction × amount), not Σ|amount|. Money paid out
   * (−1) settles the bill; money coming back in against it (+1 — the landlord
   * refunds a month) un-settles it. A magnitude sum would treat the refund as a
   * second payment and quietly mark the rent paid twice over.
   *
   * `'opening'` counts too — an expense entered before the app existed was paid
   * in money that left the drawer months ago, and the owner needs the same way to
   * say so that a supplier gets (see OPENING). Character-for-character the
   * supplier rule, which is the point: one concept, not two.
   */
  function paidByExpense(): Map<string, number> {
    const rows = db
      .select({
        refId: schema.transactions.refId,
        total: SETTLED_AMOUNT_SQL,
      })
      .from(schema.transactions)
      .where(
        and(
          inArray(schema.transactions.refKind, EXPENSE_SETTLING_KINDS),
          isNull(schema.transactions.deletedAt),
        ),
      )
      .groupBy(schema.transactions.refId)
      .all();

    // An 'opening' row against a SUPPLIER groups in here as well; its refId is a
    // supplier id, which is never an expense id (UUIDs both), so it sits in a
    // bucket no expense ever asks for. See the twin note in debt-repository.
    const paid = new Map<string, number>();
    for (const r of rows) if (r.refId) paid.set(r.refId, r.total);
    return paid;
  }

  function withDebt(e: Expense, paid: number): ExpenseDebt {
    const remaining = e.totalAmount - paid;
    return {
      ...e,
      paid,
      remaining,
      status: remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    };
  }

  const api = {
    create(input: CreateExpenseInput): Expense {
      assertValid(input);
      const ts = clock();
      const row: schema.NewExpenseRow = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        title: input.title.trim(),
        category: input.category ?? null,
        totalAmount: input.totalAmount,
        incurredAt: input.incurredAt ?? ts,
        // Free text, and it stays free text. The landlord sells the shop nothing;
        // registering him as a supplier would put a man who has never delivered a
        // box into the list the owner buys from — and into supplier debt.
        partyName: input.partyName?.trim() || null,
        note: input.note?.trim() || null,
        attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null,
      };
      db.insert(schema.expenses).values(row).run();
      return toExpense(row as schema.ExpenseRow);
    },

    get(id: string): Expense | null {
      const row = db
        .select()
        .from(schema.expenses)
        .where(and(eq(schema.expenses.id, id), live))
        .get();
      return row ? toExpense(row) : null;
    },

    /** Live expenses, most recently incurred first. Soft-deleted ones are gone. */
    list(): Expense[] {
      return db
        .select()
        .from(schema.expenses)
        .where(live)
        .orderBy(desc(schema.expenses.incurredAt), desc(schema.expenses.createdAt))
        .all()
        .map(toExpense);
    },

    /** The list the screen renders: every live expense with its derived debt. */
    listWithDebt(): ExpenseDebt[] {
      const paid = paidByExpense();
      return api.list().map((e) => withDebt(e, paid.get(e.id) ?? 0));
    },

    /** Just the ones still owing — what belongs in "what do I owe". */
    listUnpaid(): ExpenseDebt[] {
      return api.listWithDebt().filter((e) => e.remaining > 0);
    },

    /**
     * NET paid against ONE expense: Σ(−direction × amount), over the SAME kinds
     * `paidByExpense()` groups. The two are read side by side (the list, then the
     * one the owner taps), and a kind allowed into one but not the other is how
     * the list and the detail come to disagree about the same bill.
     */
    paidOn(id: string): number {
      const row = db
        .select({ total: SETTLED_AMOUNT_SQL })
        .from(schema.transactions)
        .where(
          and(
            inArray(schema.transactions.refKind, EXPENSE_SETTLING_KINDS),
            eq(schema.transactions.refId, id),
            isNull(schema.transactions.deletedAt),
          ),
        )
        .get();
      return row?.total ?? 0;
    },

    /**
     * WHAT IS STILL OWED ON ONE EXPENSE, in minor units.
     *
     * Rent 20000 with a 5000 payment ⇒ 15000, and it is still an unpaid bill
     * (TC-5.3). Negative means it was over-paid — a receivable, and NEVER clamped
     * to zero here, because clamping would silently swallow the owner's money.
     * A soft-deleted expense owes nothing at all: it returns 0.
     */
    owed(id: string): number {
      const e = api.get(id);
      if (!e) return 0; // archived (or never existed) ⇒ no obligation
      return e.totalAmount - api.paidOn(id);
    },

    /**
     * TOTAL UNPAID EXPENSES — the slice of payables the Home KPI used to omit.
     *
     * Only POSITIVE remainders are summed. An OVER-PAID expense is a receivable,
     * not a payable: netting it in would silently SHRINK what the owner thinks he
     * owes his suppliers, and he would go to bed believing a smaller number than
     * the truth. (Epic 1 made this same call for suppliers in `payables()`.)
     */
    payableTotal(): number {
      let total = 0;
      for (const e of api.listWithDebt()) {
        if (e.remaining > 0) total += e.remaining;
      }
      return total;
    },

    /** Σ of what these expenses COST (not what is owed on them) in a window. */
    totalIncurredBetween(fromMs: number, toMs: number): number {
      const row = db
        .select({ total: sql<number>`coalesce(sum(${schema.expenses.totalAmount}), 0)` })
        .from(schema.expenses)
        .where(
          and(
            live,
            sql`${schema.expenses.incurredAt} >= ${fromMs}`,
            sql`${schema.expenses.incurredAt} < ${toMs}`,
          ),
        )
        .get();
      return row?.total ?? 0;
    },

    /** Soft-delete. It vanishes from the list, from owed(), and from payables. */
    archive(id: string): void {
      const ts = clock();
      db.update(schema.expenses)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(eq(schema.expenses.id, id))
        .run();
    },
  };

  return api;
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
