import type { ItemWithStock } from '@/repositories/item-repository';
import type { InventoryItem, UnitKey } from './types';

const UNITS: UnitKey[] = ['piece', 'pair'];

const toUnit = (value: string): UnitKey =>
  UNITS.includes(value as UnitKey) ? (value as UnitKey) : 'piece';

/** Map a repository row (raw db strings) to the UI's inventory item shape. */
export function toInventoryItem(row: ItemWithStock): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    // Category is a free string now (empty when uncategorized).
    category: row.category ?? '',
    unit: toUnit(row.unit),
    costPriceMinor: row.costPrice,
    salePriceMinor: row.salePrice,
    barcode: row.barcode,
    qty: row.qtyOnHand,
    lowStockThreshold: row.lowStockThreshold,
    tags: row.tags,
    notes: row.notes,
  };
}
