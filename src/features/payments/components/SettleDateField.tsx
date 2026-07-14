import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatDate, isSameDay } from '@/utils/dates';

interface SettleDateFieldProps {
  /** When the money moved, epoch ms. */
  value: number;
  /** Step the date by whole days (−1 / +1). Capped at today by the caller. */
  onShift: (days: number) => void;
  /** Overrides "التاريخ" — the expenses form calls it "تاريخ النفقة". */
  label?: string;
}

/**
 * التاريخ — when the money MOVED, which is not always today and is almost never
 * the invoice date. The cash book follows this, so a payment handed over
 * yesterday must be recordable as yesterday.
 *
 * Day steppers rather than a calendar: a payment being recorded late is late by
 * a day or two, and the shop has no date-picker dependency to spend on it.
 * Forward is capped at today by the hook — money cannot move tomorrow.
 */
export function SettleDateField({ value, onShift, label }: SettleDateFieldProps) {
  const { t, i18n } = useTranslation();
  const today = isSameDay(value, Date.now());
  return (
    <View className={`${ROW} items-center justify-between`}>
      <View className={`${ROW} items-center gap-2`}>
        <Pressable
          className="w-9 h-9 rounded-xl items-center justify-center bg-background border border-border"
          onPress={() => onShift(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('payments.dayEarlier')}
        >
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>

        <View className="bg-background rounded-xl border border-border px-3 py-2 items-center min-w-[110px]">
          <Text className="text-ink text-sm font-bold">
            {today ? t('payments.today') : formatDate(value, i18n.language)}
          </Text>
        </View>

        <Pressable
          className={`w-9 h-9 rounded-xl items-center justify-center border ${
            today ? 'bg-background/50 border-border' : 'bg-background border-border'
          }`}
          disabled={today}
          onPress={() => onShift(1)}
          accessibilityRole="button"
          accessibilityLabel={t('payments.dayLater')}
        >
          <Feather
            name="chevron-left"
            size={16}
            color={today ? colors.border : colors.muted}
          />
        </Pressable>
      </View>

      <Text className="text-ink text-sm font-semibold">{label ?? t('payments.date')}</Text>
    </View>
  );
}
