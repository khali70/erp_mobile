import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { ExpenseStatusChip } from './ExpenseStatusChip';
import type { ExpenseViewModel } from '../presenters';

interface ExpenseRowProps {
  expense: ExpenseViewModel;
  /** Opens the سداد sheet against this expense. Absent once it is settled. */
  onSettle: () => void;
}

/**
 * One expense: category chip, what it was for, what it cost — and whether it is
 * still owed.
 *
 * The سداد button is the whole point of the row. A bill sitting here unpaid is
 * DEBT, indistinguishable in kind from a supplier invoice, and it is paid down
 * by the very same sheet. When nothing is left owing the button disappears —
 * there is nothing left to settle.
 */
export function ExpenseRow({ expense, onSettle }: ExpenseRowProps) {
  const { t } = useTranslation();
  const { icon } = expense;

  return (
    <View className="bg-surface rounded-2xl p-3.5 border border-border gap-2.5">
      <View className={`${ROW} items-center`}>
        <View className={`w-11 h-11 rounded-xl items-center justify-center ${icon.bgClass}`}>
          <Feather name={icon.icon} size={20} color={icon.color} />
        </View>

        <View className="flex-1 mx-3 gap-0.5">
          <Text className="text-ink text-sm font-extrabold text-right" numberOfLines={1}>
            {expense.title}
          </Text>
          <Text className="text-muted text-xs text-right" numberOfLines={1}>
            {expense.subtitle}
          </Text>
        </View>

        <View className="items-end gap-1">
          <MaskedValue
            id={`expense:${expense.id}`}
            dotClassName="text-sm font-extrabold text-muted"
            iconSize={13}
            dotCount={4}
          >
            <Text className="text-danger text-sm font-extrabold">{expense.amountLabel}</Text>
          </MaskedValue>
          <ExpenseStatusChip status={expense.status} label={expense.statusLabel} />
        </View>
      </View>

      {!expense.settled && (
        <View className={`${ROW} items-center justify-between`}>
          <Pressable
            className={`${ROW} items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary`}
            onPress={onSettle}
            accessibilityRole="button"
            accessibilityLabel={t('expenses.settleFor', { title: expense.title })}
          >
            <Feather name="check-circle" size={13} color={colors.surface} />
            <Text className="text-white text-xs font-bold">{t('debts.settle')}</Text>
          </Pressable>

          {expense.remainingLabel ? (
            <Text className="text-danger text-[11px] font-bold">{expense.remainingLabel}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
