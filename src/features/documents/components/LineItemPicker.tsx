import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatMoneyMajor, toArabicDigits } from '@/utils/numerals';
import { fromMinor } from '@/utils/money';
import type { InventoryItem } from '@/features/inventory/types';

interface LineItemPickerProps {
  visible: boolean;
  items: InventoryItem[];
  onClose: () => void;
  onSelect: (item: InventoryItem) => void;
}

/**
 * Bottom-sheet item chooser for the document line editor. Search by name; each
 * row shows on-hand and sale price. Selecting appends a line (qty starts at 1).
 * Real items only (from the repository) so lines carry a valid `itemId`.
 */
export function LineItemPicker({ visible, items, onClose, onSelect }: LineItemPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((i) => i.name.includes(q));
  }, [items, query]);

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

          {filtered.length === 0 ? (
            <View className="items-center gap-3 py-8">
              <Feather name="package" size={40} color={colors['slate-400']} />
              <Text className="text-muted text-sm text-center">{t('documents.itemPicker.empty')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2 pb-2">
              {filtered.map((item) => (
                <Pressable
                  key={item.id}
                  className={`${ROW} items-center gap-3 p-3 rounded-2xl border border-border bg-surface`}
                  onPress={() => {
                    onSelect(item);
                    close();
                  }}
                >
                  <View className="flex-1">
                    <Text className="text-ink text-sm font-extrabold text-right">{item.name}</Text>
                    <Text className="text-muted text-[11px] text-right mt-0.5">
                      {t('documents.itemPicker.onHand')}: {toArabicDigits(item.qty)} ·{' '}
                      {formatMoneyMajor(fromMinor(item.salePriceMinor), lang)}{' '}
                      {t('common.currency')}
                    </Text>
                  </View>
                  <Feather name="plus-circle" size={22} color={colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          )}
    </BottomSheet>
  );
}
