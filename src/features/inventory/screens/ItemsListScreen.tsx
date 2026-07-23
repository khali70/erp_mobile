import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, Alert, type ListRenderItem } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useItems } from '../hooks/useItems';
import { useCategories } from '../hooks/useCategories';
import { useItemFilter } from '../hooks/useItemFilter';
import { useItemFilterOptions } from '../hooks/useItemFilterOptions';
import { presentItem } from '../presenters';
import { toDraft, fromDraft } from '../drafts';
import { itemRepository } from '@/repositories/item-repository.client';
import { tagRepository } from '@/repositories/tag-repository.client';
import { DuplicateBarcodeError } from '@/repositories/item-repository';
import type { InventoryItem, ItemDraft, StockFilter } from '../types';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { ItemRow } from '../components/ItemRow';
import { ItemFormSheet } from '../components/ItemFormSheet';
import { BarcodeScanModal } from '../components/BarcodeScanModal';
import { ItemsFilterBar } from '../components/ItemsFilterBar';
import { ItemsEmptyState } from '../components/ItemsEmptyState';
import { AdvancedFilterSheet } from '../components/AdvancedFilterSheet';
import { ROW } from '@/theme/rtl';
import { AdvancedFilterButton } from '../components/AdvancedFilterButton';
import { StockTotalsBar } from '../components/StockTotalsBar';
import { computeStockTotals } from '../utils/stockTotals';

const keyExtractor = (item: InventoryItem) => item.id;

/**
 * البضائع — Items list (Step 1). Composition-only screen: data from the
 * repository (useItems), filtering in useItemFilter, rows via <ItemRow>.
 * All copy comes from i18n; styling is NativeWind `className` only.
 */
export function ItemsListScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, reload } = useItems();
  const { byName: categoryIndex, reload: reloadCategories } = useCategories();
  const {
    query,
    setQuery,
    filter,
    setFilter,
    advanced,
    setAdvanced,
    activeAdvancedCount,
    anyFilterActive,
    filtered,
    reset,
    resetAdvanced,
  } = useItemFilter(items);
  const { categoryOptions, tagOptions } = useItemFilterOptions(items);
  // Valued over `filtered`, not `items` — the number has to answer "what am I
  // looking at right now", otherwise it contradicts the list under it.
  const totals = useMemo(() => computeStockTotals(filtered), [filtered]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterOptions: FilterOption<StockFilter>[] = [
    { key: 'all', label: t('inventory.filters.all'), activeClass: 'bg-primary' },
    { key: 'low', label: t('inventory.filters.low'), activeClass: 'bg-warning' },
    { key: 'out', label: t('inventory.filters.out'), activeClass: 'bg-danger' },
  ];

  const openAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };
  const openEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setFormOpen(true);
  }, []);

  const renderItem: ListRenderItem<InventoryItem> = useCallback(
    ({ item }) => (
      <ItemRow
        item={presentItem(item, t, i18n.language, categoryIndex)}
        onPress={() =>
          navigation.navigate('ItemMovement', {
            itemId: item.id,
            itemName: item.name,
            unit: item.unit,
          })
        }
        onLongPress={() => openEdit(item)}
      />
    ),
    [t, i18n.language, categoryIndex, navigation, openEdit],
  );

  const handleSave = (draft: ItemDraft) => {
    try {
      const input = fromDraft(draft);
      if (editingItem) {
        itemRepository.update(editingItem.id, input);
      } else {
        itemRepository.create(input);
      }
      // Keep the tag registry current with whatever names this item used.
      if (input.tags?.length) tagRepository.upsertMany(input.tags);
      setFormOpen(false);
      reload();
      reloadCategories(); // an inline-added category should appear immediately
    } catch (e) {
      if (e instanceof DuplicateBarcodeError) {
        Alert.alert(t('inventory.form.duplicateBarcodeTitle'), t('inventory.form.duplicateBarcodeBody'));
        return; // keep the sheet open so the entered data is not lost
      }
      throw e;
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('inventory.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{ icon: 'plus', onPress: openAdd, accessibilityLabel: t('inventory.form.addTitle') }}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <ItemsFilterBar
          query={query}
          onChangeQuery={setQuery}
          onScan={() => setScanOpen(true)}
          anyActive={anyFilterActive}
          onClearAll={reset}
        />
        <View className={`${ROW} items-center justify-between gap-2.5`}>
          <FilterChips options={filterOptions} value={filter} onChange={(k: StockFilter) => setFilter(k)} />
          <AdvancedFilterButton count={activeAdvancedCount} onPress={() => setFiltersOpen(true)} />

        </View>
        {filtered.length === 0 ? (
          <ItemsEmptyState filtered={anyFilterActive} onReset={reset} />
        ) : (
          <>
            <StockTotalsBar totals={totals} />
            <FlatList
              className="flex-1"
              data={filtered}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerClassName="gap-3 pb-24"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews
              initialNumToRender={12}
              windowSize={11}
            />
          </>
        )}
      </View>

      <ItemFormSheet
        visible={formOpen}
        initial={editingItem ? toDraft(editingItem) : null}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
      <AdvancedFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={advanced}
        stock={filter}
        categoryOptions={categoryOptions}
        tagOptions={tagOptions}
        onApply={(next, stock) => {
          setAdvanced(next);
          setFilter(stock);
          setFiltersOpen(false);
        }}
        onReset={() => {
          resetAdvanced();
          setFilter('all');
        }}
      />
      <BarcodeScanModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(code) => setQuery(code)}
      />
    </View>
  );
}
