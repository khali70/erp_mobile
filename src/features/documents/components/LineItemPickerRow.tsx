import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatMoneyMajor, formatNumber } from '@/utils/numerals';
import { fromMinor } from '@/utils/money';
import { getStockStatus } from '@/utils/stock';
import type { InventoryItem } from '@/features/inventory/types';

interface LineItemPickerRowProps {
  item: InventoryItem;
  /** No stock left to give — dimmed, unpressable, and it LOOKS it. */
  disabled: boolean;
  onSelect: () => void;
}

/**
 * One item row in the line picker: name, on-hand, sale price, stock badge.
 *
 * A disabled row is still SHOWN. The owner needs to know the item exists and is
 * empty — hiding it just makes him search for it again.
 */
export function LineItemPickerRow({ item, disabled, onSelect }: LineItemPickerRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const status = getStockStatus(item.qty, item.lowStockThreshold);
  // In stock, yet nothing left to give: this document has already claimed all of
  // it on the lines the owner has built. Say which, rather than just refusing.
  const fullyClaimed = disabled && item.qty > 0;

  return (
    <Pressable
      className={`${ROW} items-center gap-3 p-3 rounded-2xl border border-border bg-surface ${
        disabled ? 'opacity-40' : ''
      }`}
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={item.name}
      accessibilityHint={
        fullyClaimed
          ? t('documents.qtyMax', { n: formatNumber(item.qty, lang) })
          : disabled
            ? t('documents.itemPicker.outOfStock')
            : undefined
      }
    >
      <View className="flex-1">
        <View className={`${ROW} items-center gap-2 justify-end`}>
          {status === 'out' && (
            <View className="bg-danger-light px-2 py-0.5 rounded-full">
              <Text className="text-danger text-[10px] font-bold">
                {t('documents.itemPicker.outOfStock')}
              </Text>
            </View>
          )}
          {status === 'low' && (
            <View className="bg-warning-light px-2 py-0.5 rounded-full">
              <Text className="text-warning-dark text-[10px] font-bold">
                {t('inventory.filters.low')}
              </Text>
            </View>
          )}
          <Text className="text-ink text-sm font-extrabold text-right">{item.name}</Text>
        </View>
        <Text className="text-muted text-[11px] text-right mt-0.5">
          {t('documents.itemPicker.onHand')}: {formatNumber(item.qty, lang)} ·{' '}
          {formatMoneyMajor(fromMinor(item.salePriceMinor), lang)} {t('common.currency')}
        </Text>
        {fullyClaimed && (
          <Text className="text-warning-dark text-[11px] text-right mt-0.5 font-bold">
            {t('documents.qtyMax', { n: formatNumber(item.qty, lang) })}
          </Text>
        )}
      </View>
      <Feather
        name={disabled ? 'slash' : 'plus-circle'}
        size={22}
        color={disabled ? colors['slate-400'] : colors.primary}
      />
    </Pressable>
  );
}
