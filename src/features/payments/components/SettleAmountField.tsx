import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { NumericInput } from '@/components/ui/NumericInput';

interface SettleAmountFieldProps {
  /** The amount as TYPED (major units). Pre-filled with the outstanding balance. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * المبلغ — how much is being handed over now.
 *
 * Pre-filled with the full outstanding balance (the common case: he came to
 * settle up), but freely editable both ways. Typing MORE than is owed is
 * allowed: it becomes a credit, never an error.
 */
export function SettleAmountField({ value, onChange }: SettleAmountFieldProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between`}>
      <NumericInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        selectTextOnFocus
        placeholder="0"
        className="bg-background text-ink text-base font-extrabold text-center px-3 py-2.5 rounded-xl border border-primary/40 min-w-[120px]"
        placeholderTextColor={colors.muted}
        accessibilityLabel={t('payments.amount')}
      />
      <Text className="text-ink text-sm font-semibold">{t('payments.amount')}</Text>
    </View>
  );
}
