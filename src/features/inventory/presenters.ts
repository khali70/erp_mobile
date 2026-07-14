import type { TFunction } from 'i18next';
import type { Category } from '@/db/schema';
import type { InventoryItem } from './types';
import { getStockStatus, type StockStatus } from '@/utils/stock';
import { formatMoneyMajor, toArabicDigits } from '@/utils/numerals';
import { fromMinor } from '@/utils/money';

/** Fully-resolved, display-ready shape consumed by <ItemRow>. */
export interface ItemRowViewModel {
  id: string;
  name: string;
  categoryLabel: string;
  categoryColor: string | null;
  priceLabel: string;
  currency: string;
  status: StockStatus;
  badgeLabel: string;
  barcodeLabel: string | null;
  salePriceLabel: string | null;
}

const STATUS_SUFFIX_KEY: Record<StockStatus, string | null> = {
  inStock: null,
  low: 'inventory.badge.lowSuffix',
  out: 'inventory.badge.outSuffix',
};

/**
 * Resolve a category name to its display label + color token. Seeded categories
 * carry an `i18nKey` (translated); user-added ones show their `name` verbatim.
 * Unknown/empty category → empty label, null color (avatar falls back).
 */
export function resolveCategory(
  name: string,
  index: Map<string, Category> | undefined,
  t: TFunction,
): { label: string; color: string | null } {
  if (!name) return { label: '', color: null };
  const cat = index?.get(name);
  if (cat?.i18nKey) return { label: t(`inventory.categories.${cat.i18nKey}`), color: cat.color };
  return { label: cat?.name ?? name, color: cat?.color ?? null };
}

/** Map a domain item to its display view-model (numerals, labels, status). */
export function presentItem(
  item: InventoryItem,
  t: TFunction,
  lang: string,
  categoryIndex?: Map<string, Category>,
): ItemRowViewModel {
  const status = getStockStatus(item.qty, item.lowStockThreshold);
  const unit = t(`inventory.units.${item.unit}`);
  const qty = toArabicDigits(status === 'out' ? 0 : item.qty);
  const suffixKey = STATUS_SUFFIX_KEY[status];
  const badgeLabel = suffixKey ? `${qty} ${unit} (${t(suffixKey)})` : `${qty} ${unit}`;
  const category = resolveCategory(item.category, categoryIndex, t);
  // MONEY — piastres kept. A 12.50 price rounded to "١٣" is a price the shop does
  // not charge. Goes through money.ts rather than a hardcoded /100 so a
  // non-2-exponent currency (KWD, JPY) doesn't silently render the wrong number.
  const priceLabel = formatMoneyMajor(fromMinor(item.salePriceMinor), lang);

  return {
    id: item.id,
    name: item.name,
    categoryLabel: category.label,
    categoryColor: category.color,
    priceLabel,
    currency: t('common.currency'),
    status,
    badgeLabel,
    barcodeLabel: item.barcode?.trim() || null,
    salePriceLabel: item.salePriceMinor > 0 ? priceLabel : null,
  };
}
