import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import type { BalanceViewModel } from '../presenters';

interface SupplierBalanceCardProps {
  balance: BalanceViewModel;
  /** Mask key — per supplier, so revealing one man's balance reveals only his. */
  maskId: string;
  onSettle: () => void;
}

/**
 * The supplier's bottom line, and the سداد button.
 *
 * A CREDIT is rendered green and titled "رصيد لك" — it is money the supplier owes
 * back, not a debt, and it must never be dressed up as one. The سداد button
 * stays available even then: paying a man you have already overpaid is unusual,
 * not forbidden, and the app has no business refusing his own money to the owner.
 */
export function SupplierBalanceCard({ balance, maskId, onSettle }: SupplierBalanceCardProps) {
  const { t } = useTranslation();
  const tone = balance.isCredit
    ? 'text-positive'
    : balance.isSettled
      ? 'text-muted'
      : 'text-danger';

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3.5">
      <View className={`${ROW} items-center justify-between`}>
        <MaskedValue
          id={maskId}
          dotClassName="text-2xl font-extrabold text-muted"
          iconSize={18}
        >
          <Text className={`text-2xl font-extrabold ${tone}`}>{balance.amountLabel}</Text>
        </MaskedValue>
        <Text className="text-muted text-xs font-semibold">{balance.title}</Text>
      </View>

      {balance.isCredit && (
        <Text className="text-positive text-[11px]">{t('debts.creditHint')}</Text>
      )}

      <Pressable
        className={`${ROW} items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary`}
        onPress={onSettle}
        accessibilityRole="button"
      >
        <Feather name="check-circle" size={17} color={colors.surface} />
        <Text className="text-white font-bold text-base">{t('debts.settle')}</Text>
      </Pressable>
    </View>
  );
}
