import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useItems } from '../hooks/useItems';
import { useItemFilter } from '../hooks/useItemFilter';
import { presentItem } from '../presenters';
import { toDraft, fromDraft } from '../drafts';
import { itemRepository } from '@/repositories/item-repository.client';
import { DuplicateBarcodeError } from '@/repositories/item-repository';
import type { InventoryItem, ItemDraft, StockFilter } from '../types';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { ItemRow } from '../components/ItemRow';
import { ItemFormSheet } from '../components/ItemFormSheet';

/**
 * البضائع — Items list (Step 1). Composition-only screen: data from the
 * repository (useItems), filtering in useItemFilter, rows via <ItemRow>.
 * All copy comes from i18n; styling is NativeWind `className` only.
 */
export function ItemsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, reload } = useItems();
  const { query, setQuery, filter, setFilter, filtered, reset } = useItemFilter(items);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const filterOptions: FilterOption<StockFilter>[] = [
    { key: 'all', label: t('inventory.filters.all'), activeClass: 'bg-primary' },
    { key: 'low', label: t('inventory.filters.low'), activeClass: 'bg-warning' },
    { key: 'out', label: t('inventory.filters.out'), activeClass: 'bg-danger' },
  ];

  const openAdd = () => {
    setEditingItem(null);
    setFormOpen(true);
  };
  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleSave = (draft: ItemDraft) => {
    try {
      const input = fromDraft(draft);
      if (editingItem) {
        itemRepository.update(editingItem.id, input);
      } else {
        itemRepository.create(input);
      }
      setFormOpen(false);
      reload();
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
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('inventory.searchPlaceholder')}
          onScanPress={() => {}}
          scanLabel={t('inventory.scan')}
        />

        <FilterChips options={filterOptions} value={filter} onChange={(k: StockFilter) => setFilter(k)} />

        {filtered.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
            <Feather name="package" size={44} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">{t('inventory.empty.message')}</Text>
            <Pressable onPress={reset} accessibilityRole="button">
              <Text className="text-xs text-primary font-bold underline">{t('inventory.empty.reset')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-24" showsVerticalScrollIndicator={false}>
            {filtered.map((item) => (
              <ItemRow
                key={item.id}
                item={presentItem(item, t)}
                category={item.category}
                onPress={() =>
                  navigation.navigate('ItemMovement', {
                    itemId: item.id,
                    itemName: item.name,
                    unit: item.unit,
                  })
                }
                onLongPress={() => openEdit(item)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <ItemFormSheet
        visible={formOpen}
        initial={editingItem ? toDraft(editingItem) : null}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </View>
  );
}
