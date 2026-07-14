import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatMoneyMajor } from '@/utils/numerals';

interface RemainingDebtRowProps {
  /** Total − paid, in whole currency units. Only rendered when positive. */
  remaining: number;
}

/**
 * باقي عليك — what the owner still owes after this payment.
 *
 * TWO STATES, NOT ONE. It used to render NOTHING when the purchase was paid in
 * full, and absence is a terrible way to say "you owe nothing": an empty space
 * is equally consistent with the app having failed to notice the payment at all.
 * Paid-in-full is an ANSWER, and it is now said out loud, in green.
 *
 * DANGER, not warning, for the remainder: `warning` is the receivables colour
 * (money owed TO the shop) and `danger` is payables (the shop owes). A supplier
 * remainder is a PAYABLE, and it is painted danger on every other screen that
 * shows one — SupplierDebtRow, DebtsTotalCard, UnpaidExpenseRow.
 */
export function RemainingDebtRow({ remaining }: RemainingDebtRowProps) {
  const { t, i18n } = useTranslation();

  if (remaining <= 0) {
    return (
      <View className={`${ROW} items-center gap-2 pt-3 border-t border-border`}>
        <Feather name="check-circle" size={16} color={colors.positive} />
        <Text className="text-positive text-sm font-extrabold">{t('payments.paidInFull')}</Text>
      </View>
    );
  }

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
