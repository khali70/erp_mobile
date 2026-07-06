import type { InventoryItem, ItemDraft } from './types';
import { toMajor } from '@/utils/money';

/** Build an editable form draft from an existing item (minor units → major string). */
export function toDraft(item: InventoryItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    costPrice: '',
    salePrice: toMajor(item.salePriceMinor),
    lowStockThreshold: String(item.lowStockThreshold),
    barcode: '',
  };
}
