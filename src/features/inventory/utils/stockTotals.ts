import { lineTotal } from '@/utils/money';
import type { InventoryItem } from '../types';

export interface StockTotals {
  /** How many distinct products are in the set. */
  itemCount: number;
  /** Sum of qty on hand across the set (can be fractional for weighed units). */
  totalQty: number;
  /** Σ qty × costPrice — what the stock COST. The inventory valuation. */
  costValueMinor: number;
  /** Σ qty × salePrice — what the stock would FETCH at list price. */
  saleValueMinor: number;
  /** How many items carry stock but no cost price, so they value at zero. */
  missingCostCount: number;
}

/**
 * Value the stock on hand.
 *
 * Two totals, because they answer different questions and the owner needs both:
 * cost value is what the shelves are worth (money already spent, the number
 * that belongs on a balance sheet), sale value is what they'd bring in at list
 * price. Neither is "the" total — showing only one invites the wrong read.
 *
 * `missingCostCount` exists because a zero cost price is indistinguishable from
 * genuinely-free stock in the total. An item sitting there with qty 40 and no
 * cost silently drags the valuation down; the UI surfaces the count so the
 * number is never quietly wrong.
 *
 * Pure and sync — it runs over an already-loaded array, so it can sit on the
 * render path behind a useMemo.
 */
export function computeStockTotals(items: InventoryItem[]): StockTotals {
  let totalQty = 0;
  let costValueMinor = 0;
  let saleValueMinor = 0;
  let missingCostCount = 0;

  for (const item of items) {
    totalQty += item.qty;
    // lineTotal is the one place qty × price rounding happens — reuse it so a
    // fractional qty rounds the same way here as it does on a document line.
    costValueMinor += lineTotal(item.qty, item.costPriceMinor);
    saleValueMinor += lineTotal(item.qty, item.salePriceMinor);
    if (item.qty > 0 && item.costPriceMinor <= 0) missingCostCount += 1;
  }

  return {
    itemCount: items.length,
    totalQty,
    costValueMinor,
    saleValueMinor,
    missingCostCount,
  };
}
