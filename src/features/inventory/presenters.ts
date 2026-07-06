import type { TFunction } from 'i18next';
import type { InventoryItem } from './types';
import { getStockStatus, type StockStatus } from '@/utils/stock';
import { toArabicDigits } from '@/utils/numerals';

/** Fully-resolved, display-ready shape consumed by <ItemRow>. */
export interface ItemRowViewModel {
  id: string;
  name: string;
  categoryLabel: string;
  priceLabel: string;
  currency: string;
  status: StockStatus;
  badgeLabel: string;
}

const STATUS_SUFFIX_KEY: Record<StockStatus, string | null> = {
  inStock: null,
  low: 'inventory.badge.lowSuffix',
  out: 'inventory.badge.outSuffix',
};

/** Map a domain item to its display view-model (numerals, labels, status). */
export function presentItem(item: InventoryItem, t: TFunction): ItemRowViewModel {
  const status = getStockStatus(item.qty, item.lowStockThreshold);
  const unit = t(`inventory.units.${item.unit}`);
  const qty = toArabicDigits(status === 'out' ? 0 : item.qty);
  const suffixKey = STATUS_SUFFIX_KEY[status];
  const badgeLabel = suffixKey ? `${qty} ${unit} (${t(suffixKey)})` : `${qty} ${unit}`;

  return {
    id: item.id,
    name: item.name,
    categoryLabel: t(`inventory.categories.${item.category}`),
    priceLabel: toArabicDigits(Math.round(item.salePriceMinor / 100)),
    currency: t('common.currency'),
    status,
    badgeLabel,
  };
}
