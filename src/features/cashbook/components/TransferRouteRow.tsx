import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { Account } from '@/repositories/transaction-repository';

interface TransferRouteRowProps {
  from: Account;
  to: Account;
}

/**
 * "من النقدي ← إلى إنستاباي" — where the money is going, spelled out.
 *
 * The owner picks only the SOURCE pocket (the الحساب toggle above); the
 * destination is the other one, because there are exactly two and a transfer to
 * the pocket it came from is not a transfer. So the route is shown, not asked —
 * one less thing to get wrong, and no way to record a movement into thin air.
 */
export function TransferRouteRow({ from, to }: TransferRouteRowProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between bg-background rounded-xl px-3 py-2.5`}>
      <View className={`${ROW} items-center gap-2`}>
        <Text className="text-xs font-bold text-muted">{t(`payments.accounts.${from}`)}</Text>
        <Feather name="arrow-left" size={14} color={colors.primary} />
        <Text className="text-xs font-bold text-ink">{t(`payments.accounts.${to}`)}</Text>
      </View>
      <Text className="text-ink text-sm font-semibold">{t('cashbook.form.route')}</Text>
    </View>
  );
}
