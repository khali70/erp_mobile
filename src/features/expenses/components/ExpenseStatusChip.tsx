import { Text, View } from 'react-native';
import type { ExpenseDebt } from '@/repositories/expense-repository';

interface ExpenseStatusChipProps {
  status: ExpenseDebt['status'];
  label: string;
}

/**
 * مسددة / سداد جزئي / غير مسددة.
 *
 * This chip is DERIVED — there is no `paid` column behind it. It is the sign of
 * `total_amount − Σ payments`, rendered. Which is why it can never disagree with
 * the cash book: it IS the cash book.
 */
const TONE: Record<ExpenseDebt['status'], string> = {
  paid: 'bg-positive-light text-positive',
  partial: 'bg-warning-light text-warning-dark',
  unpaid: 'bg-danger-light text-danger',
};

export function ExpenseStatusChip({ status, label }: ExpenseStatusChipProps) {
  const [bg, fg] = TONE[status].split(' ');
  return (
    <View className={`px-2 py-0.5 rounded-lg ${bg}`}>
      <Text className={`text-[10px] font-bold ${fg}`}>{label}</Text>
    </View>
  );
}
