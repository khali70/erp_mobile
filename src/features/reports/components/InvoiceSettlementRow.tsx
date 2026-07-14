import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { SettlementViewModel } from '../presenters';

interface InvoiceSettlementRowProps {
  settlement: SettlementViewModel;
  onPress: () => void;
}

/** Icon + color per settlement state. Green = done, amber = part-way, red = untouched. */
const TONE = {
  settled: { icon: 'check-circle', color: colors.positive, text: 'text-positive' },
  partial: { icon: 'clock', color: colors.warning, text: 'text-warning' },
  unpaid: { icon: 'alert-circle', color: colors.danger, text: 'text-danger' },
} as const;

/**
 * ONE INVOICE, AND WHAT THE PAYMENTS ACTUALLY COVERED:
 *
 *   IN-000012 · سُدّدت بالكامل — ٢٥
 *   IN-000014 · سداد جزئي — ١٥ (باقي ١٠)
 *
 * This is the line that settles an argument with the supplier. It is DERIVED at
 * read time by walking his invoices oldest-first against his payments — there is
 * no allocation row behind it and there never will be, and the owner never sees
 * that word. He sees "IN-000012 · سُدّدت بالكامل".
 */
export function InvoiceSettlementRow({ settlement, onPress }: InvoiceSettlementRowProps) {
  const tone = TONE[settlement.status];
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3 flex-1`}>
        <Feather name={tone.icon} size={18} color={tone.color} />
        <View className="gap-0.5 flex-1">
          <Text className="text-sm font-bold text-ink text-right" numberOfLines={1}>
            {settlement.docNoLabel}
          </Text>
          <Text className="text-[11px] text-muted text-right">{settlement.dateLabel}</Text>
        </View>
      </View>

      <View className="items-end gap-0.5">
        <Text className="text-sm font-extrabold text-ink">{settlement.totalLabel}</Text>
        <Text className={`text-[11px] font-semibold ${tone.text}`}>{settlement.statusLabel}</Text>
        {settlement.remainingLabel && (
          <Text className="text-[11px] text-muted">{settlement.remainingLabel}</Text>
        )}
      </View>
    </Pressable>
  );
}
