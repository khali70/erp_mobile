import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import { formatMoneyMajor } from '@/utils/numerals';

interface RemainingDebtRowProps {
  /** Total − paid, in whole currency units. Only rendered when positive. */
  remaining: number;
}

/**
 * المتبقي (دين) — what the owner still owes after this payment.
 *
 * Shown ONLY when it is greater than zero. A permanent "٠ ج.م" line would train
 * the eye to skip the row, and this is the one number on the screen that means
 * he now owes somebody money.
 *
 * DANGER, not warning: `warning` is the receivables colour (money owed TO the
 * shop) and `danger` is payables (the shop owes). A supplier remainder is a
 * PAYABLE, and it is painted danger on every other screen that shows one —
 * SupplierDebtRow, DebtsTotalCard, UnpaidExpenseRow.
 */
export function RemainingDebtRow({ remaining }: RemainingDebtRowProps) {
  const { t, i18n } = useTranslation();
  if (remaining <= 0) return null;
  return (
    <View className={`${ROW} items-center justify-between pt-3 border-t border-danger/30`}>
      <Text className="text-danger text-base font-extrabold">
        {formatMoneyMajor(remaining, i18n.language)}{' '}
        <Text className="text-xs font-normal">{t('common.currency')}</Text>
      </Text>
      <Text className="text-danger text-sm font-extrabold">{t('payments.remaining')}</Text>
    </View>
  );
}
