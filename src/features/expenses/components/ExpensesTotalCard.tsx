import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';

interface ExpensesTotalCardProps {
  /** What the month COST, pre-formatted — paid or not. */
  monthLabel: string;
  /** The month's name, localised ("يوليو"). */
  monthName: string;
  lastMonthLabel: string;
  /** What is STILL OWED on the expenses, pre-formatted. Null when nothing is. */
  unpaidLabel: string | null;
}

/**
 * The month's expenses — and, separately, what is still OWED on them.
 *
 * These are two different questions and the card must never fuse them. A rent
 * bill that has been paid still COST the shop 20,000 (it belongs in the month's
 * total); it simply is not debt any more. The unpaid line is the one that feeds
 * the Home payables KPI — it is the slice the owner could not see at all before.
 */
export function ExpensesTotalCard({
  monthLabel,
  monthName,
  lastMonthLabel,
  unpaidLabel,
}: ExpensesTotalCardProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-5 border border-border items-center gap-1">
      <MaskedValue id="expenses:month" dotClassName="text-3xl font-extrabold text-muted" iconSize={20}>
        <Text className="text-danger text-3xl font-extrabold">{monthLabel}</Text>
      </MaskedValue>

      <Text className="text-muted text-sm font-semibold">
        {t('expenses.currentMonth', { month: monthName })}
      </Text>
      <Text className="text-slate-400 text-xs">
        {t('expenses.lastMonth')}: {lastMonthLabel}
      </Text>

      {unpaidLabel ? (
        <View className={`${ROW} items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-danger-light`}>
          <Feather name="alert-circle" size={13} color={colors.danger} />
          <Text className="text-danger text-xs font-bold">
            {t('expenses.unpaidTotal', { amount: unpaidLabel })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
