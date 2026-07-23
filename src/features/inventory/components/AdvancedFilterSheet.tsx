import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { MultiSelectChips, type MultiSelectOption } from '@/components/ui/MultiSelectChips';
import { PriceRangeInput } from '@/components/ui/PriceRangeInput';
import { FilterSection } from './FilterSection';
import {
  EMPTY_ADVANCED_FILTERS,
  countActiveFilters,
  type AdvancedItemFilters,
  type PricingModeFilter,
} from '../utils/filterItems';
import type { StockFilter } from '../types';

interface AdvancedFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Committed filters — the sheet edits a draft copy of these. */
  value: AdvancedItemFilters;
  stock: StockFilter;
  categoryOptions: MultiSelectOption[];
  tagOptions: MultiSelectOption[];
  /** Commit the draft and close. */
  onApply: (filters: AdvancedItemFilters, stock: StockFilter) => void;
  /** Clear every filter immediately, leaving the sheet open. */
  onReset: () => void;
}

/**
 * The advanced-filter panel. It edits a LOCAL draft and only publishes it on
 * Apply, so a half-typed price range never makes the list flicker underneath.
 * Reset clears every dimension immediately (and publishes that), because
 * "clear" that still needs a confirming tap is not a clear.
 */
export function AdvancedFilterSheet({
  visible,
  onClose,
  value,
  stock,
  categoryOptions,
  tagOptions,
  onApply,
  onReset,
}: AdvancedFilterSheetProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<AdvancedItemFilters>(value);
  const [stockDraft, setStockDraft] = useState<StockFilter>(stock);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setStockDraft(stock);
    }
  }, [visible, value, stock]);

  const update = <K extends keyof AdvancedItemFilters>(key: K, next: AdvancedItemFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const handleReset = () => {
    setDraft(EMPTY_ADVANCED_FILTERS);
    setStockDraft('all');
    onReset();
  };

  const stockOptions: FilterOption<StockFilter>[] = [
    { key: 'all', label: t('inventory.filters.all'), activeClass: 'bg-primary' },
    { key: 'low', label: t('inventory.filters.low'), activeClass: 'bg-warning' },
    { key: 'out', label: t('inventory.filters.out'), activeClass: 'bg-danger' },
  ];

  const modeOptions: FilterOption<PricingModeFilter>[] = [
    { key: 'any', label: t('inventory.advancedFilters.modeAny'), activeClass: 'bg-primary' },
    { key: 'fixed', label: t('inventory.advancedFilters.modeFixed'), activeClass: 'bg-primary' },
    {
      key: 'negotiable',
      label: t('inventory.advancedFilters.modeNegotiable'),
      activeClass: 'bg-primary',
    },
  ];

  const activeCount = countActiveFilters(draft);
  const currency = t('common.currency');
  const fromLabel = t('inventory.advancedFilters.min');
  const toLabel = t('inventory.advancedFilters.max');

  return (
    <BottomSheet visible={visible} onClose={onClose} className="overflow-hidden">
      <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
        <View className={`${ROW} items-center gap-2`}>
          <Feather name="sliders" size={18} color={colors['primary-200']} />
          <Text className="text-white font-bold text-base">
            {t('inventory.advancedFilters.title')}
          </Text>
        </View>
        <Pressable
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: HEADER_OVERLAY }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Feather name="x" size={16} color={colors.surface} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 gap-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSection title={t('inventory.advancedFilters.category')}>
          <MultiSelectChips
            options={categoryOptions}
            value={draft.categories}
            onChange={(next) => update('categories', next)}
          />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.salePrice')}>
          <PriceRangeInput
            minValue={draft.salePriceMin}
            maxValue={draft.salePriceMax}
            onChangeMin={(v) => update('salePriceMin', v)}
            onChangeMax={(v) => update('salePriceMax', v)}
            minLabel={fromLabel}
            maxLabel={toLabel}
            suffix={currency}
          />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.costPrice')}>
          <PriceRangeInput
            minValue={draft.costPriceMin}
            maxValue={draft.costPriceMax}
            onChangeMin={(v) => update('costPriceMin', v)}
            onChangeMax={(v) => update('costPriceMax', v)}
            minLabel={fromLabel}
            maxLabel={toLabel}
            suffix={currency}
          />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.stock')}>
          <FilterChips options={stockOptions} value={stockDraft} onChange={setStockDraft} />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.qty')}>
          <PriceRangeInput
            minValue={draft.qtyMin}
            maxValue={draft.qtyMax}
            onChangeMin={(v) => update('qtyMin', v)}
            onChangeMax={(v) => update('qtyMax', v)}
            minLabel={fromLabel}
            maxLabel={toLabel}
          />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.pricingMode')}>
          <FilterChips
            options={modeOptions}
            value={draft.pricingMode}
            onChange={(mode) => update('pricingMode', mode)}
          />
        </FilterSection>

        <FilterSection title={t('inventory.advancedFilters.tags')}>
          <MultiSelectChips
            options={tagOptions}
            value={draft.tags}
            onChange={(next) => update('tags', next)}
            emptyLabel={t('inventory.advancedFilters.noTags')}
          />
        </FilterSection>
      </ScrollView>

      <View className={`${ROW} items-center gap-3 px-5 py-4 border-t border-border`}>
        <Pressable
          className="flex-1 py-3.5 rounded-2xl items-center bg-surface border border-border"
          onPress={handleReset}
          accessibilityRole="button"
        >
          <Text className="font-bold text-sm text-muted">
            {t('inventory.advancedFilters.reset')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-[2] py-3.5 rounded-2xl items-center bg-primary"
          onPress={() => onApply(draft, stockDraft)}
          accessibilityRole="button"
        >
          <Text className="font-bold text-sm text-white">
            {activeCount > 0
              ? `${t('inventory.advancedFilters.apply')} (${formatNumber(activeCount, i18n.language)})`
              : t('inventory.advancedFilters.apply')}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
