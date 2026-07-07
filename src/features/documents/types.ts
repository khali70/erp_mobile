/** Shared shapes for the document (sale/purchase) forms. Demo-level until repos. */

export type DocMode = 'sale' | 'purchase';

export interface DocLine {
  id: string;
  /**
   * Real inventory item id the line posts to. `null` for a fast-entry line not
   * yet resolved — find-or-create runs at save time and fills it in.
   */
  itemId: string | null;
  name: string;
  unit: string;
  /** Whole currency units (major). Sale = unit price, purchase = unit cost. */
  unitPrice: number;
  qty: number;
  // Fast-entry provenance (undefined for from-list / scan lines).
  category?: string;
  tags?: string[];
  note?: string;
  imageUri?: string;
  // CSV-import provenance: extra catalog fields to seed a find-or-created item.
  // Major units for price fields; undefined on non-import lines.
  salePrice?: number;
  barcode?: string;
  lowStockThreshold?: number;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  /** Outstanding debt in whole currency units; 0 = settled. */
  debt: number;
}

/** The fast-entry row's field values (strings as typed; prices are major). */
export interface QuickEntryValues {
  category: string;
  title: string;
  price: string;
  qty: string;
  tags: string[];
  note: string;
}

/** Per-field lock: a locked field keeps its value when the row resets after add. */
export type QuickEntryLocks = Record<keyof QuickEntryValues, boolean>;
