import { and, eq, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebtDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

/**
 * DERIVED SUPPLIER DEBT (accounts payable).
 *
 *   owed(S) = Σ documents.total_amount  WHERE kind='in' AND party_id=S
 *                                         AND status='posted' AND deleted_at IS NULL
 *           − Σ transactions.amount     WHERE ref_kind='supplier' AND ref_id=S
 *                                         AND deleted_at IS NULL
 *
 * Debt is DERIVED, never stored. A stored debt column drifts the first time a
 * save half-fails or a document is soft-deleted, and then the owner sees "you
 * owe Ahmed 340" while the invoices add up to 300 and he cannot tell which is
 * lying. A derived number cannot disagree with the invoices, because it IS the
 * invoices. (`suppliers.balance` is retired and read by nothing.)
 *
 * Two filters carry this entire file, and forgetting either is the likeliest
 * source of a silently wrong number — a figure that is plausible, undetectable
 * and false:
 *   • `status = 'posted'`  — a DRAFT purchase is not an obligation. Nothing was
 *                            taken from anyone yet.
 *   • `deleted_at IS NULL` — on BOTH sides. A soft-deleted invoice owes nothing,
 *                            and a soft-deleted payment paid nothing.
 *
 * All figures are INTEGER minor units. Negative owed = CREDIT (the supplier owes
 * you — رصيد لك). That is a legitimate state, never an error, and never clamped.
 */
export function createDebtRepository(db: DebtDb) {
  /** Σ posted, live purchase invoices billed to this supplier. */
  function invoicedTo(supplierId: string): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${schema.documents.totalAmount}), 0)` })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.kind, 'in'),
          eq(schema.documents.partyId, supplierId),
          eq(schema.documents.status, 'posted'), // a draft is not an obligation
          isNull(schema.documents.deletedAt),
        ),
      )
      .get();
    return row?.total ?? 0;
  }

  /** Σ live payments pointing at this supplier (amounts are always positive). */
  function paidTo(supplierId: string): number {
    const row = db
      .select({ total: sql<number>`coalesce(sum(${schema.transactions.amount}), 0)` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.refKind, 'supplier'),
          eq(schema.transactions.refId, supplierId),
          isNull(schema.transactions.deletedAt),
        ),
      )
      .get();
    return row?.total ?? 0;
  }

  /** Live, real (non-sentinel) suppliers — the only parties that can carry debt. */
  function realSuppliers() {
    return db
      .select({
        id: schema.suppliers.id,
        name: schema.suppliers.name,
        phone: schema.suppliers.phone,
      })
      .from(schema.suppliers)
      .where(and(isNull(schema.suppliers.deletedAt), eq(schema.suppliers.isSystem, 0)))
      .all();
  }

  function isSentinel(supplierId: string): boolean {
    const row = db
      .select({ isSystem: schema.suppliers.isSystem })
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, supplierId))
      .get();
    return row?.isSystem === 1;
  }

  const api = {
    /**
     * What the shop owes ONE supplier, in minor units. Negative = credit.
     *
     * A sentinel (walk-in) party always reports 0 — deliberately, even if a
     * legacy or imported row left it holding a balance. Otherwise the owner's
     * payables read "بدون مورد owes you 500": a debt to nobody, which he can
     * neither act on nor reconcile. Guard #3 of the four sentinel guards.
     */
    owed(supplierId: string): number {
      if (isSentinel(supplierId)) return 0;
      return invoicedTo(supplierId) - paidTo(supplierId);
    },

    /**
     * Derived debt for every real supplier, keyed by id — one map for the whole
     * screen, so a list of N suppliers costs 2 queries, not 2N. Credits (negative)
     * are included; callers decide whether a credit is worth showing.
     */
    owedBySupplier(): Map<string, number> {
      const owed = new Map<string, number>();
      for (const s of realSuppliers()) owed.set(s.id, api.owed(s.id));
      return owed;
    },

    /**
     * TOTAL PAYABLES — the Home KPI.
     *
     * Only POSITIVE debts are summed: a supplier in credit is a receivable, not
     * a payable, and netting him against the others would understate what the
     * owner actually has to pay out. Sentinels are excluded by `realSuppliers()`.
     *
     * Returned as a BREAKDOWN rather than a bare number so Epic 3 can add unpaid
     * expenses (rent is debt too) by filling in `expenses` — no consumer rewrite,
     * no changed call sites. Until then it is honestly 0.
     */
    payables(): { suppliers: number; expenses: number; total: number } {
      let suppliersTotal = 0;
      for (const amount of api.owedBySupplier().values()) {
        if (amount > 0) suppliersTotal += amount;
      }
      const expenses = 0; // Epic 3: Σ owed(E) over unpaid expenses.
      return { suppliers: suppliersTotal, expenses, total: suppliersTotal + expenses };
    },
  };

  return api;
}

export type DebtRepository = ReturnType<typeof createDebtRepository>;
