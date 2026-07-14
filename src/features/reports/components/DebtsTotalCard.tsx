import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';

interface DebtsTotalCardProps {
  /** Σ of every positive debt on the list, pre-formatted. */
  totalLabel: string;
  /** How many suppliers are owed, pre-formatted. */
  countLabel: string;
}

/**
 * The one number the owner came for: everything he owes his suppliers, added up.
 *
 * It is the Σ of the rows BELOW it — only positive debts, no credits netted in —
 * so it can never disagree with the list it sits on top of.
 */
export function DebtsTotalCard({ totalLabel, countLabel }: DebtsTotalCardProps) {
  const { t } = useTranslation();
  return (
    <View className={`bg-surface rounded-2xl p-4 border border-border ${ROW} items-center justify-between`}>
      <View className={`${ROW} items-center gap-2.5`}>
        <View className="w-9 h-9 rounded-xl items-center justify-center bg-danger-light">
          <Feather name="trending-down" size={18} color={colors.danger} />
        </View>
        <View className="gap-0.5">
          <Text className="text-muted text-[11px] font-semibold text-right">
            {t('debts.totalOwed')}
          </Text>
          <Text className="text-muted text-[11px] text-right">{countLabel}</Text>
        </View>
      </View>

      <MaskedValue
        id="debts:total"
        dotClassName="text-lg font-extrabold text-muted"
        iconSize={16}
      >
        <Text className="text-lg font-extrabold text-danger">{totalLabel}</Text>
      </MaskedValue>
    </View>
  );
}
