import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MultiSelectOption } from '@/components/ui/MultiSelectChips';
import { UNCATEGORIZED } from '../utils/filterItems';
import type { InventoryItem } from '../types';
import { useCategories } from './useCategories';

/**
 * The pickable values for the advanced-filter sheet: the category registry
 * (localised, plus an "uncategorized" bucket) and the union of tags actually
 * carried by the loaded items — offering a tag nothing matches is noise.
 */
export function useItemFilterOptions(items: InventoryItem[]) {
  const { t } = useTranslation();
  const { categories } = useCategories();

  const categoryOptions = useMemo<MultiSelectOption[]>(() => {
    const options = categories.map((category) => ({
      key: category.name,
      label: category.i18nKey ? t(`inventory.categories.${category.i18nKey}`) : category.name,
    }));
    const hasUncategorized = items.some((item) => item.category === '');
    if (hasUncategorized) {
      options.push({ key: UNCATEGORIZED, label: t('inventory.advancedFilters.uncategorized') });
    }
    return options;
  }, [categories, items, t]);

  const tagOptions = useMemo<MultiSelectOption[]>(() => {
    const names = new Set<string>();
    items.forEach((item) => item.tags.forEach((tag) => names.add(tag)));
    return [...names].sort().map((name) => ({ key: name, label: name }));
  }, [items]);

  return { categoryOptions, tagOptions };
}
