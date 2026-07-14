import { itemRepository } from '@/repositories/item-repository.client';
import { documentRepository } from '@/repositories/document-repository.client';
import { debtRepository } from '@/repositories/debt-repository.client';
import { getStockStatus } from '@/utils/stock';
import { fromMinor } from '@/utils/money';

/** Dashboard KPI figures. Money fields are MAJOR units. */
export interface DashboardStats {
  inventoryValue: number; // Σ on-hand × cost
  monthlyRevenue: number; // this-month sales revenue
  monthlyProfit: number; // this-month sales revenue − COGS
  /** Net margin as a whole percent of revenue. null when there were no sales. */
  monthlyMarginPct: number | null;
  /**
   * TOTAL PAYABLES: supplier debt + unpaid bills. Renamed from `supplierDebt`,
   * because that is no longer what it holds — RENT IS DEBT TOO, and a field name
   * that says "supplier" invites the next reader to re-narrow the very figure
   * this epic widened.
   */
  totalPayables: number;
  docCount: number; // posted documents
  lowStockCount: number; // items at/below threshold (low + out)
  computedAt: number; // epoch ms of computation
}

/**
 * Heavy aggregation over items, stock, suppliers and this month's posted sales
 * (per-line COGS). Pure sync SQL — call OFF the render path (see
 * useDashboardStats, which defers it past interactions) and cache the result.
 */
export function computeDashboardStats(): DashboardStats {
  const items = itemRepository.listWithStock();

  let inventoryValueMinor = 0;
  let lowStockCount = 0;
  const costByItem = new Map<string, number>();
  for (const it of items) {
    inventoryValueMinor += it.qtyOnHand * it.costPrice;
    costByItem.set(it.id, it.costPrice);
    if (getStockStatus(it.qtyOnHand, it.lowStockThreshold) !== 'inStock') lowStockCount += 1;
  }

  // TOTAL PAYABLES, DERIVED — supplier debt (posted purchase invoices minus
  // payments) PLUS every unpaid bill (each expense's total minus the payments
  // pointing at it). RENT IS DEBT TOO.
  //
  // This KPI has been wrong twice, in two different ways. It used to sum
  // `suppliers.balance`, a column nothing ever wrote, so it read 0 forever no
  // matter how much the shop owed. Epic 1 fixed that — and it was STILL wrong,
  // because it counted only suppliers: an owner with 20,000 of unpaid rent saw
  // none of it. `payables()` now answers the whole question, and because Epic 1
  // shaped it as a BREAKDOWN rather than a bare number, this line did not have to
  // change to start telling the truth.
  const payables = debtRepository.payables();
  const payablesMinor = payables.total; // suppliers + unpaid expenses

  const posted = documentRepository.list({ status: 'posted' });

  // Current-month profit: outgoing (sale) docs dated this month.
  const d = new Date();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  let revenueMinor = 0;
  let cogsMinor = 0;
  for (const doc of posted) {
    if (doc.kind !== 'out') continue;
    const when = doc.docDate ?? doc.postedAt ?? 0;
    if (when < monthStart) continue;
    const full = documentRepository.getWithLines(doc.id);
    if (!full) continue;
    for (const line of full.lines) {
      revenueMinor += line.qty * line.unitPrice;
      cogsMinor += line.qty * (costByItem.get(line.itemId) ?? 0);
    }
  }

  const profitMinor = revenueMinor - cogsMinor;

  return {
    inventoryValue: Math.round(fromMinor(inventoryValueMinor)),
    monthlyRevenue: Math.round(fromMinor(revenueMinor)),
    monthlyProfit: Math.round(fromMinor(profitMinor)),
    // No sales this month means there is no margin — not a margin of zero. A
    // fabricated 0٪ sitting next to real numbers is worse than an empty tag.
    monthlyMarginPct: revenueMinor === 0 ? null : Math.round((profitMinor / revenueMinor) * 100),
    totalPayables: Math.round(fromMinor(payablesMinor)),
    docCount: posted.length,
    lowStockCount,
    computedAt: Date.now(),
  };
}

// Module-level cache: survives screen navigation; recomputed on cold start or
// manual reload. Not persisted (recompute is the source of truth).
let cache: DashboardStats | null = null;
export const getCachedStats = (): DashboardStats | null => cache;
export const setCachedStats = (s: DashboardStats): void => {
  cache = s;
};
