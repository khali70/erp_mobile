import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import type { InventoryItem } from '@/features/inventory/types';
import type { DocStock } from '../hooks/useStockCeilings';
import { LineItemPickerRow } from './LineItemPickerRow';

type StockScope = 'inStock' | 'all';

interface LineItemPickerProps {
  visible: boolean;
  items: InventoryItem[];
  /** Sale ceilings. `enforced === false` ⇒ this sheet behaves exactly as it always did. */
  stock: DocStock;
  onClose: () => void;
  onSelect: (item: InventoryItem) => void;
}

/**
 * Bottom-sheet item chooser for the document line editor. Search by name; each
 * row shows on-hand, sale price and its stock badge.
 *
 * STOCK IS A CONSTRAINT HERE, not a decoration. On a sale (with
 * `allowNegativeStock` off) the sheet opens on what he can actually sell, and an
 * item with nothing left is dimmed and unpressable — the overdraw is refused at
 * SELECTION, not thrown back at him after he has built the whole invoice.
 *
 * But it is never HIDDEN: the "all" chip brings the empty items back into view,
 * disabled, because "the item is not there" and "the item is there and empty"
 * are different facts and he needs the second one.
 */
export function LineItemPicker({ visible, items, stock, onClose, onSelect }: LineItemPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<StockScope>('inStock');

  const matched = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((i) => i.name.includes(q));
  }, [items, query]);

  // The stock filter only exists when stock is being enforced; on a purchase, or
  // with negative stock allowed, every item is listed as before.
  const hideEmpty = stock.enforced && scope === 'inStock';
  const visibleItems = useMemo(
    () => (hideEmpty ? matched.filter((i) => i.qty > 0) : matched),
    [matched, hideEmpty],
  );

  const scopeOptions: FilterOption<StockScope>[] = [
    { key: 'inStock', label: t('documents.itemPicker.inStockOnly'), activeClass: 'bg-primary' },
    { key: 'all', label: t('documents.itemPicker.showOutOfStock'), activeClass: 'bg-primary' },
  ];

  // Two different emptinesses: "nothing matches that search" and "the search
  // matched, but none of it is in stock". The second one is not a dead end — it
  // is a fact about the shop, and the chip above it is the way to see the items.
  const emptyKey =
    visibleItems.length === 0 && matched.length > 0
      ? 'documents.itemPicker.emptyInStock'
      : 'documents.itemPicker.empty';

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} className="px-4 pt-4 pb-8">
      <View className="self-center w-10 h-1.5 rounded-full bg-border mb-3" />

      <View className={`${ROW} items-center justify-between mb-4`}>
        <View className={`${ROW} items-center gap-2`}>
          <Feather name="package" size={20} color={colors.primary} />
          <Text className="text-ink text-base font-extrabold">{t('documents.itemPicker.title')}</Text>
        </View>
        <Pressable
          className="w-9 h-9 rounded-full bg-background items-center justify-center"
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Feather name="x" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View className="relative w-full mb-3">
        <View className="absolute inset-y-0 right-3 justify-center z-10">
          <Feather name="search" size={18} color={colors['slate-400']} />
        </View>
        <TextInput
          className="w-full bg-background text-ink pr-10 pl-3 py-3 rounded-2xl border border-primary/40 text-sm text-right"
          placeholder={t('documents.itemPicker.searchPlaceholder')}
          placeholderTextColor={colors['slate-400']}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {stock.enforced && (
        <View className="mb-3">
          <FilterChips options={scopeOptions} value={scope} onChange={setScope} />
        </View>
      )}

      {visibleItems.length === 0 ? (
        <View className="items-center gap-3 py-8">
          <Feather name="package" size={40} color={colors['slate-400']} />
          <Text className="text-muted text-sm text-center">{t(emptyKey)}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2 pb-2">
          {visibleItems.map((item) => (
            <LineItemPickerRow
              key={item.id}
              item={item}
              disabled={!stock.canAdd(item)}
              onSelect={() => {
                onSelect(item);
                close();
              }}
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}
