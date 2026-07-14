import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import { SectionLabel } from './SectionLabel';
import { UnpaidExpenseRow } from './UnpaidExpenseRow';
import type { UnpaidExpenseViewModel } from '../presenters';

interface UnpaidExpensesSectionProps {
  expenses: UnpaidExpenseViewModel[];
  /** Σ of the remainders below, pre-formatted. */
  totalLabel: string;
  onPressExpense: (id: string) => void;
}

/**
 * الفواتير والمصروفات غير المسددة — the OTHER half of "what do I owe".
 *
 * Suppliers are only one slice of the answer. Rent, electricity and repairs are
 * obligations with no goods, no lines and no invoice, and a debts screen that
 * showed only suppliers was answering a narrower question than the owner asked.
 *
 * Renders nothing at all when every bill is settled — an empty heading over an
 * empty list would read as a section that failed to load.
 */
export function UnpaidExpensesSection({
  expenses,
  totalLabel,
  onPressExpense,
}: UnpaidExpensesSectionProps) {
  const { t } = useTranslation();
  if (expenses.length === 0) return null;

  return (
    <View className="gap-3 mt-4">
      <View className={`${ROW} items-center justify-between`}>
        <SectionLabel title={t('debts.unpaidExpenses')} icon="file-text" />
        <Text className="text-danger text-xs font-extrabold">{totalLabel}</Text>
      </View>

      {expenses.map((e) => (
        <UnpaidExpenseRow key={e.id} expense={e} onPress={() => onPressExpense(e.id)} />
      ))}
    </View>
  );
}
