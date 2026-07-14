import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import type { UnpaidExpenseViewModel } from '../presenters';

interface UnpaidExpenseRowProps {
  expense: UnpaidExpenseViewModel;
  /** Through to the expenses screen, where it can be paid. */
  onPress: () => void;
}

/** One unpaid bill on the debts screen: what it was for, and what is left owing. */
export function UnpaidExpenseRow({ expense, onPress }: UnpaidExpenseRowProps) {
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3 flex-1`}>
        <View className="w-9 h-9 rounded-xl items-center justify-center bg-expense-light">
          <Feather name="file-text" size={16} color={colors.expense} />
        </View>
        <View className="gap-0.5 flex-1">
          <Text className="text-sm font-semibold text-ink text-right" numberOfLines={1}>
            {expense.title}
          </Text>
          <Text className="text-[11px] text-muted font-medium text-right" numberOfLines={1}>
            {expense.subtitle}
          </Text>
        </View>
      </View>

      <View className="items-end gap-1">
        <MaskedValue
          id={`expense:${expense.id}`}
          dotClassName="text-sm font-extrabold text-muted"
          iconSize={13}
          dotCount={4}
        >
          <Text className="text-sm font-extrabold text-danger">{expense.remainingLabel}</Text>
        </MaskedValue>
        {expense.partialLabel ? (
          <Text className="text-[11px] text-muted font-medium">{expense.partialLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
