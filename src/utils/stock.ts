// Stock-status derivation. Pure business logic, no React / no IO — unit-testable.

export type StockStatus = 'inStock' | 'low' | 'out';

/** Derive a stock status from on-hand quantity and the item's low-stock threshold. */
export function getStockStatus(qty: number, lowStockThreshold: number): StockStatus {
  if (qty <= 0) return 'out';
  if (qty <= lowStockThreshold) return 'low';
  return 'inStock';
}
