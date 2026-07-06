import type { ItemWithStock } from '@/repositories/item-repository';
import type { InventoryItem, ItemCategory, UnitKey } from './types';

const CATEGORIES: ItemCategory[] = [
  'tshirts',
  'jackets',
  'shoes',
  'pants',
  'shirts',
  'accessories',
  'other',
];
const UNITS: UnitKey[] = ['piece', 'pair'];

const toCategory = (value: string | null): ItemCategory =>
  CATEGORIES.includes(value as ItemCategory) ? (value as ItemCategory) : 'other';

const toUnit = (value: string): UnitKey =>
  UNITS.includes(value as UnitKey) ? (value as UnitKey) : 'piece';

/** Map a repository row (raw db strings) to the UI's inventory item shape. */
export function toInventoryItem(row: ItemWithStock): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: toCategory(row.category),
    unit: toUnit(row.unit),
    salePriceMinor: row.salePrice,
    qty: row.qtyOnHand,
    lowStockThreshold: row.lowStockThreshold,
  };
}
