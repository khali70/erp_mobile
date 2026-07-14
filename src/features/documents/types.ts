/** Shared shapes for the document (sale/purchase) forms. Demo-level until repos. */

import type { PricingMode } from '@/repositories/item-repository';

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
  // Pricing context snapshotted from the catalog item when the line was added, so
  // the row can show margin live while the owner haggles. Major units, like
  // `unitPrice`. Undefined on fast-entry lines (no catalog item yet).
  listPrice?: number; // the item's sale price — the anchor `unitPrice` starts at
  costPrice?: number; // weighted-average cost, for the margin readout
  minPrice?: number; // soft floor; undefined = none
  pricingMode?: PricingMode;
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

/**
 * What a scan did to the document. A REFUSAL is a result, not a silent zero:
 * scanning an item the shop has run out of (or has already fully committed to
 * this invoice) must say so on the camera strip, not quietly bump a line.
 */
export type ScanAppendResult =
  | { ok: true; qty: number }
  | { ok: false; name: string; available: number };

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
