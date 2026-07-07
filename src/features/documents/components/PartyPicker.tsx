import { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatNumber } from '@/utils/numerals';
import type { DocMode, Party } from '../types';

interface PartyPickerProps {
  visible: boolean;
  mode: DocMode;
  parties: Party[];
  onClose: () => void;
  /** null = walk-in (cash, no party). */
  onSelect: (party: Party | null) => void;
  /** Quick-add: caller creates + persists a party from the raw query. */
  onQuickAdd: (query: string) => void;
}

/**
 * Bottom-sheet party chooser used by both sale (customer) and purchase
 * (supplier) forms. Search by name OR phone, walk-in shortcut, and a quick-add
 * row when the query has no exact match. NativeWind only; copy via i18n.
 */
export function PartyPicker({ visible, mode, parties, onClose, onSelect, onQuickAdd }: PartyPickerProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const ns = mode === 'sale' ? 'documents.outgoing' : 'documents.incoming';

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return parties;
    return parties.filter((p) => p.name.includes(q) || p.phone.includes(q));
  }, [parties, query]);

  const showQuickAdd = query.trim().length > 0 && filtered.length === 0;

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} className="px-4 pt-4 pb-8">
          {/* grab handle */}
          <View className="self-center w-10 h-1.5 rounded-full bg-border mb-3" />

          {/* header */}
          <View className={`${ROW} items-center justify-between mb-4`}>
            <View className={`${ROW} items-center gap-2`}>
              <Feather name="user" size={20} color={colors.primary} />
              <Text className="text-ink text-base font-extrabold">{t(`${ns}.pickerTitle`)}</Text>
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

          {/* walk-in */}
          <Pressable
            className={`${ROW} items-center justify-center gap-2 py-3.5 rounded-2xl border border-border bg-background mb-3`}
            onPress={() => {
              onSelect(null);
              close();
            }}
          >
            <Feather name="zap" size={16} color={colors.muted} />
            <Text className="text-ink text-sm font-bold">{t(`${ns}.walkIn`)}</Text>
          </Pressable>

          {/* search */}
          <View className="relative w-full mb-3">
            <View className="absolute inset-y-0 right-3 justify-center z-10">
              <Feather name="search" size={18} color={colors['slate-400']} />
            </View>
            <TextInput
              className="w-full bg-background text-ink pr-10 pl-3 py-3 rounded-2xl border border-primary/40 text-sm text-right"
              placeholder={t('documents.picker.searchPlaceholder')}
              placeholderTextColor={colors['slate-400']}
              value={query}
              onChangeText={setQuery}
              keyboardType="default"
            />
          </View>

          {/* quick-add */}
          {showQuickAdd && (
            <Pressable
              className={`${ROW} items-center gap-3 p-3.5 rounded-2xl border border-dashed border-primary bg-primary-light mb-3`}
              onPress={() => {
                onQuickAdd(query.trim());
                close();
              }}
            >
              <Feather name="user-plus" size={20} color={colors.primary} />
              <View className="flex-1">
                <Text className="text-primary text-sm font-extrabold text-right">
                  + {t(`${ns}.quickAdd`, { q: query.trim() })}
                </Text>
                {mode === 'sale' && (
                  <Text className="text-muted text-[11px] text-right mt-0.5">
                    {t('documents.outgoing.quickAddHint')}
                  </Text>
                )}
              </View>
            </Pressable>
          )}

          {/* party list */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2 pb-2">
            {filtered.map((p) => (
              <Pressable
                key={p.id}
                className={`${ROW} items-center gap-3 p-3 rounded-2xl border ${
                  p.debt > 0 ? 'border-warning/30 bg-warning-light' : 'border-border bg-surface'
                }`}
                onPress={() => {
                  onSelect(p);
                  close();
                }}
              >
                <View className="w-10 h-10 rounded-full bg-background items-center justify-center">
                  <Text className="text-ink font-extrabold text-base">{p.name.charAt(0)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-sm font-extrabold text-right">{p.name}</Text>
                  <View className={`${ROW} items-center gap-1 justify-end mt-0.5`}>
                    <Text className="text-muted text-xs">{p.phone}</Text>
                    <Feather name="phone" size={12} color={colors.muted} />
                  </View>
                </View>
                {p.debt > 0 && (
                  <View className="px-2 py-1 rounded-md bg-warning-light border border-warning/40">
                    <Text className="text-warning-dark text-[11px] font-bold">
                      {t('documents.picker.debtTag')}: {formatNumber(p.debt, i18n.language)} {t('common.currency')}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>

          {/* register CTA (purchase mirrors web's bottom supplier CTA) */}
          {mode === 'purchase' && (
            <Pressable
              className={`${ROW} items-center justify-center gap-2 py-3.5 mt-2 rounded-2xl border border-dashed border-primary`}
              onPress={() => {
                onQuickAdd(query.trim());
                close();
              }}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text className="text-primary text-sm font-bold">{t('documents.incoming.quickAddCta')}</Text>
            </Pressable>
          )}
    </BottomSheet>
  );
}
