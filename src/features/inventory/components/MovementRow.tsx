import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import type { MovementRowViewModel } from '../movement-presenters';

interface MovementRowProps {
  row: MovementRowViewModel;
  balanceLabel: string; // localized "Balance" caption
  onPress?: () => void;
}

/** One ledger movement: direction icon, doc + date, signed qty, running balance. */
export function MovementRow({ row, balanceLabel, onPress }: MovementRowProps) {
  const tint = row.isIncoming ? 'text-positive' : 'text-danger';
  const iconBox = row.isIncoming ? 'bg-positive-light' : 'bg-danger-light';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 bg-surface rounded-2xl p-3.5 border border-border"
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center ${iconBox}`}>
        <Feather
          name={row.isIncoming ? 'arrow-down-left' : 'arrow-up-right'}
          size={20}
          color={row.isIncoming ? colors.positive : colors.danger}
        />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-foreground">{row.docLabel}</Text>
        <Text className="text-xs text-muted">{row.dateLabel}</Text>
      </View>

      <View className="items-end gap-0.5">
        <Text className={`text-sm font-bold ${tint}`}>{row.qtyLabel}</Text>
        <Text className="text-[11px] text-muted">
          {balanceLabel} {row.balanceLabel}
        </Text>
      </View>
    </Pressable>
  );
}
