import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface PaidAmountRowProps {
  /** The value as typed (major units). Pre-filled with the full total until touched. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * المدفوع — how much actually changed hands.
 *
 * Pre-filled with the FULL TOTAL: this shop rarely buys on debt, so the common
 * path must need zero extra input and paying less has to be a deliberate act.
 *
 * The value arrives DISPLAY-SHAPED (٢٥٫٢٠) and is handed back raw; the hook
 * normalises it to canonical digits before anything parses it.
 */
export function PaidAmountRow({ value, onChange }: PaidAmountRowProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between`}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        selectTextOnFocus
        // The screen's most important input: a 44pt target, not a 36pt one.
        className="bg-background text-ink text-sm font-extrabold text-center px-3 py-3 rounded-xl border border-primary/40 min-w-[96px]"
        placeholderTextColor={colors.muted}
        accessibilityLabel={t('payments.paid')}
      />
      <Text className="text-ink text-sm font-semibold">{t('payments.paid')}</Text>
    </View>
  );
}
