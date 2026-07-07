// Inventory domain view-types. Real items will come from the repository/ledger;
// these describe the shape screens/components consume.

// Categories are now user-extensible data (see `categories` table), so the type
// is an open string (the category name/key), not a fixed union. The seven
// defaults still ship via the seed.
export type ItemCategory = string;

export type UnitKey = 'piece' | 'pair';

export type StockFilter = 'all' | 'low' | 'out';

/**
 * An inventory item as the UI consumes it. `salePriceMinor` is INTEGER minor
 * units (never float); `qty` is derived on-hand from the stock ledger.
 */
export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  unit: UnitKey;
  costPriceMinor: number;
  salePriceMinor: number;
  barcode: string | null;
  qty: number;
  lowStockThreshold: number;
  tags: string[];
  notes: string | null;
}

/** Editable fields captured by the item form (add / edit). */
export interface ItemDraft {
  name: string;
  category: ItemCategory;
  unit: UnitKey;
  costPrice: string;
  salePrice: string;
  lowStockThreshold: string;
  barcode: string;
  tags: string[];
  notes: string;
}
