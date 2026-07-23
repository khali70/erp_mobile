import { computeStockTotals } from './stockTotals';
import type { InventoryItem } from '../types';

function item(over: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    name: 'صنف',
    category: 'tshirts',
    unit: 'piece',
    costPriceMinor: 10_000,
    salePriceMinor: 20_000,
    pricingMode: 'fixed',
    minPriceMinor: null,
    barcode: null,
    qty: 5,
    lowStockThreshold: 2,
    tags: [],
    notes: null,
    ...over,
  };
}

describe('computeStockTotals', () => {
  it('returns zeroes for an empty set', () => {
    expect(computeStockTotals([])).toEqual({
      itemCount: 0,
      totalQty: 0,
      costValueMinor: 0,
      saleValueMinor: 0,
      missingCostCount: 0,
    });
  });

  it('sums qty x cost and qty x sale across items', () => {
    const totals = computeStockTotals([
      item({ id: 'a', qty: 3, costPriceMinor: 10_000, salePriceMinor: 15_000 }),
      item({ id: 'b', qty: 2, costPriceMinor: 25_000, salePriceMinor: 40_000 }),
    ]);
    expect(totals.itemCount).toBe(2);
    expect(totals.totalQty).toBe(5);
    expect(totals.costValueMinor).toBe(3 * 10_000 + 2 * 25_000);
    expect(totals.saleValueMinor).toBe(3 * 15_000 + 2 * 40_000);
  });

  it('contributes nothing for zero stock', () => {
    const totals = computeStockTotals([item({ id: 'a', qty: 0, costPriceMinor: 50_000 })]);
    expect(totals.costValueMinor).toBe(0);
    expect(totals.itemCount).toBe(1);
  });

  it('counts stocked items that have no cost price', () => {
    const totals = computeStockTotals([
      item({ id: 'a', qty: 4, costPriceMinor: 0 }),
      item({ id: 'b', qty: 0, costPriceMinor: 0 }), // no stock -> not "missing", just empty
      item({ id: 'c', qty: 4, costPriceMinor: 1_000 }),
    ]);
    expect(totals.missingCostCount).toBe(1);
  });

  it('rounds a fractional qty half-up, once per line', () => {
    // 1.5 x 333 = 499.5 -> 500, not truncated to 499.
    const totals = computeStockTotals([
      item({ id: 'a', qty: 1.5, costPriceMinor: 333, salePriceMinor: 333 }),
    ]);
    expect(totals.costValueMinor).toBe(500);
    expect(totals.totalQty).toBe(1.5);
  });

  it('stays integral in minor units across many fractional lines', () => {
    const totals = computeStockTotals(
      Array.from({ length: 3 }, (_, i) => item({ id: `x${i}`, qty: 0.5, costPriceMinor: 101 })),
    );
    expect(Number.isInteger(totals.costValueMinor)).toBe(true);
    expect(totals.costValueMinor).toBe(153); // round(50.5) = 51, x3
  });
});
