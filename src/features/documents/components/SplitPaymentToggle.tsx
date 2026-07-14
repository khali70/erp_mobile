import { View, Text, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface SplitPaymentToggleProps {
  value: boolean;
  onChange: (split: boolean) => void;
}

/**
 * تقسيم الدفع — "he paid me part cash, part InstaPay".
 *
 * OFF by default, because most sales land in a single pocket and a second amount
 * field the owner has to zero out on every ordinary sale is a tax on the common
 * case. Splitting is the exception, so it costs one tap — and nothing until then.
 */
export function SplitPaymentToggle({ value, onChange }: SplitPaymentToggleProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between`}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        accessibilityLabel={t('payments.split')}
      />
      <Text className="text-ink text-sm font-semibold">{t('payments.split')}</Text>
    </View>
  );
}
