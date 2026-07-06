// Inventory domain view-types. Real items will come from the repository/ledger;
// these describe the shape screens/components consume.

export type ItemCategory =
  | 'tshirts'
  | 'jackets'
  | 'shoes'
  | 'pants'
  | 'shirts'
  | 'accessories'
  | 'other';

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
  salePriceMinor: number;
  qty: number;
  lowStockThreshold: number;
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
}
