import { itemRepository } from '@/repositories/item-repository.client';
import { documentRepository } from '@/repositories/document-repository.client';
import { supplierRepository } from '@/repositories/supplier-repository';
import { getStockStatus } from '@/utils/stock';

/** Dashboard KPI figures. Money fields are MAJOR units (already /100). */
export interface DashboardStats {
  inventoryValue: number; // Σ on-hand × cost
  monthlyProfit: number; // this-month sales revenue − COGS
  supplierDebt: number; // Σ positive supplier balances (payable)
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

  const supplierDebtMinor = supplierRepository
    .list()
    .reduce((sum, s) => (s.balance > 0 ? sum + s.balance : sum), 0);

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

  return {
    inventoryValue: Math.round(inventoryValueMinor / 100),
    monthlyProfit: Math.round((revenueMinor - cogsMinor) / 100),
    supplierDebt: Math.round(supplierDebtMinor / 100),
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
