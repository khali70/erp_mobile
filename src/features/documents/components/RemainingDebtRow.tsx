import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';

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
 */
export function RemainingDebtRow({ remaining }: RemainingDebtRowProps) {
  const { t, i18n } = useTranslation();
  if (remaining <= 0) return null;
  return (
    <View className={`${ROW} items-center justify-between pt-3 border-t border-warning/30`}>
      <Text className="text-warning-dark text-base font-extrabold">
        {formatNumber(remaining, i18n.language)}{' '}
        <Text className="text-xs font-normal">{t('common.currency')}</Text>
      </Text>
      <Text className="text-warning-dark text-sm font-extrabold">{t('payments.remaining')}</Text>
    </View>
  );
}
