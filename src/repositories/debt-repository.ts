import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { now } from '@/utils/id';
import type { AttachmentMeta } from './document-repository';
import { SETTLED_AMOUNT_SQL, type Account } from './transaction-repository';
import { createExpenseRepository, type ExpenseDebt } from './expense-repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebtDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

const DAY_MS = 86_400_000;

/** One purchase invoice, as the FIFO walk consumes it. Money = minor units. */
export interface DebtInvoice {
  documentId: string;
  docNo: string | null;
  docDate: number;
  total: number;
}

/** How much of ONE invoice the supplier's payments turn out to have covered. */
export interface InvoiceSettlement extends DebtInvoice {
  /** Minor units of this invoice covered by the FIFO walk. */
  paid: number;
  /** total − paid. Zero ⇒ settled. */
  remaining: number;
  status: 'settled' | 'partial' | 'unpaid';
}

/** One payment made to a supplier — the other half of his ledger. */
export interface DebtPayment {
  id: string;
  amount: number;
  occurredAt: number;
  account: Account;
  note: string | null;
  /** PROOF OF MONEY — the InstaPay screenshot, if there is one. */
  attachments: AttachmentMeta[];
}

/** A row of the debts-by-supplier list. Only ever built for `owed > 0`. */
export interface SupplierDebt {
  id: string;
  name: string;
  phone: string | null;
  /** Minor units, always > 0 in this list. */
  owed: number;
  /** docDate of the oldest invoice the payments have NOT fully covered. */
  oldestUnpaidAt: number;
  /** Whole days between `oldestUnpaidAt` and the INJECTED clock. Never negative. */
  ageDays: number;
}

/** Everything the supplier-detail screen shows. `owed < 0` ⇒ credit (رصيد لك). */
export interface SupplierDebtDetail {
  owed: number;
  invoices: InvoiceSettlement[];
  payments: DebtPayment[];
  /** Money paid beyond every invoice — the credit the supplier is holding. */
  credit: number;
}

/**
 * THE FIFO WALK — invoice-level settlement, DERIVED at read time.
 *
 * There are NO allocation rows in this database and there must never be any: no
 * `payment_allocations` table, no `paid_amount` column, no `settled` flag. A
 * payment points at the SUPPLIER, not at an invoice — that single decision is
 * what collapses the entire allocation problem, and this function is what buys
 * back the invoice-level detail it seemed to cost.
 *
 * The invoices arrive OLDEST FIRST and each one drinks from the pool of what the
 * supplier has been paid, until the pool runs dry. Walking payments oldest-first
 * would give the identical answer — a payment is fungible money against one
 * supplier's book, so only the TOTAL can matter — which is precisely why the
 * pool is a single number here.
 *
 * It is deterministic BECAUSE there is no manual invoice-picking anywhere in the
 * UI. No user action can contradict it, so it can never disagree with `owed()`:
 * Σ remaining === owed whenever owed > 0.
 *
 * All figures are INTEGER minor units, so the walk is exact integer arithmetic —
 * no float ever rounds a piastre out of existence.
 */
export function walkFifo(invoices: DebtInvoice[], paidTotal: number): InvoiceSettlement[] {
  let pool = Math.max(0, paidTotal);
  return invoices.map((inv) => {
    const paid = Math.min(pool, inv.total);
    pool -= paid;
    const remaining = inv.total - paid;
    return {
      ...inv,
      paid,
      remaining,
      status: remaining === 0 ? 'settled' : paid === 0 ? 'unpaid' : 'partial',
    };
  });
}

/**
 * DERIVED SUPPLIER DEBT (accounts payable).
 *
 *   owed(S) = Σ documents.total_amount        WHERE kind='in' AND party_id=S
 *                                               AND status='posted' AND deleted_at IS NULL
 *           − Σ (−direction × transactions.amount) WHERE ref_kind='supplier' AND ref_id=S
 *                                               AND deleted_at IS NULL
 *
 * The payment side is SIGNED, never a Σ|amount|: money OUT (−1) pays the debt
 * down, money IN against the same supplier (+1 — a refund, a returned crate)
 * pushes it back UP. Summing magnitudes has a refund PAY OFF the debt it should
 * re-create.
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
 *
 * `clock` is INJECTED — aging ("this debt is 45 days old") is the one figure here
 * that depends on the present moment, and a `Date.now()` buried in a repository
 * is a test that flakes at midnight.
 */
export function createDebtRepository(db: DebtDb, clock: () => number = now) {
  // Expenses are debt too, and their debt is derived by the SAME subtraction as
  // a supplier's. Composed here rather than re-implemented, so there is exactly
  // one definition of "what is still owed on an expense" in the codebase.
  const expenses = createExpenseRepository(db, clock);

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

  /**
   * What the shop has NET PAID this supplier: Σ(−direction × amount) over his
   * live rows.
   *
   * SIGNED, not a Σ|amount|. A −1 row is money handed over and pays the debt
   * down. A +1 row against the same supplier is money coming BACK (a refund, a
   * returned crate) and pushes the debt back UP — which a magnitude sum gets
   * exactly backwards, letting a refund PAY OFF the debt it should re-create.
   * Nothing writes a +1 supplier row today; the sign is encoded here rather than
   * assumed, so that the day something does, this number moves the right way on
   * its own.
   */
  function paidTo(supplierId: string): number {
    const row = db
      .select({ total: SETTLED_AMOUNT_SQL })
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

  /**
   * This supplier's posted, live purchase invoices, OLDEST FIRST — the order the
   * FIFO walk depends on. `created_at` breaks a same-day tie, because two
   * invoices dated the same morning still have an order the owner would
   * recognise: the one he entered first.
   *
   * THE SORT KEY AND THE RETURNED KEY ARE THE SAME EXPRESSION, and they have to
   * be. `doc_date` is nullable, and SQLite sorts NULL FIRST — so ordering by the
   * raw column while returning `doc_date ?? created_at` made every legacy
   * undated row sort as the OLDEST invoice the supplier has, whatever its real
   * age. FIFO would then drink the supplier's money into a row the owner cannot
   * even see the date of, and the aging on the debts list would read from it.
   * `coalesce` in the SQL is what keeps the walk's order and its dates one fact.
   */
  const invoiceDate = sql<number>`coalesce(${schema.documents.docDate}, ${schema.documents.createdAt})`;

  function invoicesOf(supplierId: string): DebtInvoice[] {
    return db
      .select({
        documentId: schema.documents.id,
        docNo: schema.documents.docNo,
        docDate: invoiceDate,
        total: schema.documents.totalAmount,
      })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.kind, 'in'),
          eq(schema.documents.partyId, supplierId),
          eq(schema.documents.status, 'posted'),
          isNull(schema.documents.deletedAt),
        ),
      )
      .orderBy(asc(invoiceDate), asc(schema.documents.createdAt))
      .all()
      .map((r) => ({
        documentId: r.documentId,
        docNo: r.docNo,
        docDate: r.docDate,
        total: r.total,
      }));
  }

  /** This supplier's live payments, oldest money first (his payment history). */
  function paymentsOf(supplierId: string): DebtPayment[] {
    return db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
        occurredAt: schema.transactions.occurredAt,
        account: schema.transactions.account,
        note: schema.transactions.note,
        attachments: schema.transactions.attachments,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.refKind, 'supplier'),
          eq(schema.transactions.refId, supplierId),
          isNull(schema.transactions.deletedAt),
        ),
      )
      .orderBy(asc(schema.transactions.occurredAt), asc(schema.transactions.createdAt))
      .all()
      .map((r) => ({
        id: r.id,
        amount: r.amount,
        occurredAt: r.occurredAt,
        account: r.account as Account,
        note: r.note,
        attachments: parseAttachments(r.attachments),
      }));
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

  /** Whole days from `since` to the injected now. Floors; never negative. */
  function ageInDays(since: number): number {
    return Math.max(0, Math.floor((clock() - since) / DAY_MS));
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
     * Derived debt for every real supplier, keyed by id — ONE map for the whole
     * screen, in 3 queries flat (the suppliers, then one GROUP BY per side of the
     * subtraction), not 2 per supplier.
     *
     * It used to loop `owed(s.id)` over every supplier — 2 full scans of
     * `documents`/`transactions` EACH, while the docstring above it claimed "2
     * queries, not 2N". It is read on every focus of the debts screen and again
     * inside `computeDashboardStats()` on Home, so the shop's home screen was
     * paying N × (2 scans) to render one number.
     *
     * Credits (negative) are included; callers decide whether a credit is worth
     * showing. Sentinels are absent — `realSuppliers()` filters them out, and the
     * grouped rows for a sentinel are simply never looked up (guard #3).
     */
    owedBySupplier(): Map<string, number> {
      const invoiced = new Map<string, number>();
      const invoicedRows = db
        .select({
          partyId: schema.documents.partyId,
          total: sql<number>`coalesce(sum(${schema.documents.totalAmount}), 0)`,
        })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.kind, 'in'),
            eq(schema.documents.status, 'posted'), // a draft is not an obligation
            isNull(schema.documents.deletedAt), // a deleted invoice owes nothing
          ),
        )
        .groupBy(schema.documents.partyId)
        .all();
      for (const r of invoicedRows) if (r.partyId) invoiced.set(r.partyId, r.total);

      const paid = new Map<string, number>();
      const paidRows = db
        .select({
          refId: schema.transactions.refId,
          total: SETTLED_AMOUNT_SQL, // SIGNED — a refund is not a payment
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.refKind, 'supplier'),
            isNull(schema.transactions.deletedAt), // a deleted payment paid nothing
          ),
        )
        .groupBy(schema.transactions.refId)
        .all();
      for (const r of paidRows) if (r.refId) paid.set(r.refId, r.total);

      const owed = new Map<string, number>();
      for (const s of realSuppliers()) {
        owed.set(s.id, (invoiced.get(s.id) ?? 0) - (paid.get(s.id) ?? 0));
      }
      return owed;
    },

    /**
     * The DERIVED invoice-level breakdown for one supplier — what the owner sees
     * as "IN-000012 · سُدّدت بالكامل". He never sees the word "allocation",
     * because there is nothing to allocate: see `walkFifo`.
     *
     * A sentinel walks nothing. Its debt is defined as 0 (guard #3), so a
     * per-invoice breakdown of it would contradict its own total.
     */
    settlements(supplierId: string): InvoiceSettlement[] {
      if (isSentinel(supplierId)) return [];
      return walkFifo(invoicesOf(supplierId), paidTo(supplierId));
    },

    /**
     * THE DEBTS LIST — every supplier the shop actually owes, WORST FIRST.
     *
     * Only `owed > 0`. A fully-paid supplier is not a debt and does not belong on
     * a screen whose whole job is "who do I pay next"; a supplier in CREDIT is a
     * receivable, and putting him here would read as if the shop owed him money.
     * Both are still reachable from the suppliers list, where they belong.
     *
     * Sentinels cannot appear: `realSuppliers()` filters them out and `owed()`
     * reports 0 for them anyway — two independent guards, because the failure
     * mode ("بدون مورد owes you 500") is a debt to nobody (TC-9.3).
     */
    list(): SupplierDebt[] {
      const rows: SupplierDebt[] = [];
      for (const s of realSuppliers()) {
        const settlements = walkFifo(invoicesOf(s.id), paidTo(s.id));
        const owed = settlements.reduce((sum, x) => sum + x.remaining, 0);
        if (owed <= 0) continue;
        // The oldest invoice the money has NOT yet reached. It exists whenever
        // owed > 0 — that is the same statement, read from the other end.
        const oldest = settlements.find((x) => x.remaining > 0)!;
        rows.push({
          id: s.id,
          name: s.name,
          phone: s.phone,
          owed,
          oldestUnpaidAt: oldest.docDate,
          ageDays: ageInDays(oldest.docDate),
        });
      }
      return rows.sort((a, b) => b.owed - a.owed);
    },

    /** One supplier's whole book: invoices (settled by the walk) + payments. */
    detail(supplierId: string): SupplierDebtDetail {
      const invoices = api.settlements(supplierId);
      const payments = isSentinel(supplierId) ? [] : paymentsOf(supplierId);
      const owed = api.owed(supplierId);
      return { owed, invoices, payments, credit: Math.max(0, -owed) };
    },

    /** Every expense still owing, most recently incurred first. */
    unpaidExpenses(): ExpenseDebt[] {
      return expenses.listUnpaid();
    },

    /**
     * TOTAL PAYABLES — the Home KPI, and now the WHOLE truth.
     *
     * RENT IS DEBT TOO. Until Epic 3 this counted suppliers and nothing else, so
     * an owner with 20,000 of unpaid rent saw none of it: the number on his home
     * screen was not merely incomplete, it was confidently wrong, and wrong in
     * the direction that feels like good news. Debt comes from OBLIGATIONS, and a
     * purchase invoice is only one thing that creates one.
     *
     * Only POSITIVE debts are summed, on BOTH sides. A supplier in credit is a
     * receivable, not a payable, and so is an over-paid expense — netting either
     * one in would silently SHRINK what the owner believes he owes everybody
     * else, understating the very figure he is checking.
     *
     * The BREAKDOWN shape is unchanged from Epic 1, which is why not one consumer
     * (`dashboard-stats.ts` included) needed touching to start telling the truth.
     */
    payables(): { suppliers: number; expenses: number; total: number } {
      let suppliersTotal = 0;
      for (const amount of api.owedBySupplier().values()) {
        if (amount > 0) suppliersTotal += amount;
      }
      const expensesTotal = expenses.payableTotal();
      return {
        suppliers: suppliersTotal,
        expenses: expensesTotal,
        total: suppliersTotal + expensesTotal,
      };
    },
  };

  return api;
}

export type DebtRepository = ReturnType<typeof createDebtRepository>;
