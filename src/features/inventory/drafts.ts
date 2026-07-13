import type { InventoryItem, ItemDraft } from './types';
import type { CreateItemInput } from '@/repositories/item-repository';
import { toMajor, toMinor } from '@/utils/money';

/** Build an editable form draft from an existing item (minor units → major string). */
export function toDraft(item: InventoryItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    costPrice: item.costPriceMinor ? toMajor(item.costPriceMinor) : '',
    salePrice: item.salePriceMinor ? toMajor(item.salePriceMinor) : '',
    pricingMode: item.pricingMode,
    minPrice: item.minPriceMinor !== null ? toMajor(item.minPriceMinor) : '',
    lowStockThreshold: String(item.lowStockThreshold),
    barcode: item.barcode ?? '',
    tags: item.tags,
    notes: item.notes ?? '',
  };
}

/** Map a form draft to a repository input (major strings → minor units). */
export function fromDraft(draft: ItemDraft): CreateItemInput {
  const barcode = draft.barcode.trim();
  const threshold = parseInt(draft.lowStockThreshold, 10);
  const notes = draft.notes.trim();
  return {
    name: draft.name.trim(),
    category: draft.category,
    unit: draft.unit,
    barcode: barcode === '' ? null : barcode,
    costPrice: draft.costPrice.trim() === '' ? 0 : toMinor(draft.costPrice),
    salePrice: draft.salePrice.trim() === '' ? 0 : toMinor(draft.salePrice),
    pricingMode: draft.pricingMode,
    // A floor only makes sense on a haggled item; a blank field means "no floor".
    minPrice:
      draft.pricingMode === 'negotiable' && draft.minPrice.trim() !== ''
        ? toMinor(draft.minPrice)
        : null,
    lowStockThreshold: Number.isFinite(threshold) ? threshold : 0,
    tags: draft.tags.map((tg) => tg.trim()).filter(Boolean),
    notes: notes === '' ? null : notes,
  };
}
