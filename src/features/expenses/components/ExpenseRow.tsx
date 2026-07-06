import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import { CATEGORY_META, type Expense } from '../data';

/** One expense row: category icon chip, statement + date·category, amount (red). */
export function ExpenseRow({ expense }: { expense: Expense }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meta = CATEGORY_META[expense.category];
  const month = t('expenses.monthName', { defaultValue: 'يوليو' });

  return (
    <View className={`${ROW} items-center bg-surface rounded-2xl p-3.5 border border-border`}>
      <View className={`w-11 h-11 rounded-xl items-center justify-center ${meta.bgClass}`}>
        <Feather name={meta.icon} size={20} color={meta.color} />
      </View>

      <View className="flex-1 mx-3">
        <Text className="text-ink text-sm font-extrabold text-right">{expense.statement}</Text>
        <Text className="text-muted text-xs mt-0.5 text-right">
          {formatNumber(expense.day, lang)} {month} · {t(`expenses.filters.${expense.category}`)}
        </Text>
      </View>

      <Text className="text-danger text-sm font-extrabold">
        {formatNumber(expense.amount, lang)} {t('common.currency')}
      </Text>
    </View>
  );
}
