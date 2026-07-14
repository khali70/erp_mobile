import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import type { AccountTotals } from '@/repositories/transaction-repository';
import { money } from '../presenters';

interface CashBalanceCardsProps {
  balances: AccountTotals;
}

/**
 * THE TWO POCKETS, SIDE BY SIDE AND NEVER MERGED.
 *
 * The drawer holds notes the owner can count; InstaPay holds a balance in an
 * app he can open. Each reconciles against something real, on its own. A single
 * combined figure reconciles against NOTHING — there is no object in the world
 * you can hold up next to it — which is why the sum is a quiet footnote here and
 * the two real numbers are the headline.
 */
export function CashBalanceCards({ balances }: CashBalanceCardsProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const pockets = [
    { key: 'cash' as const, icon: 'dollar-sign' as const, value: balances.cash },
    { key: 'instapay' as const, icon: 'smartphone' as const, value: balances.instapay },
  ];

  return (
    <View className="gap-2">
      <View className={`${ROW} gap-3`}>
        {pockets.map((p) => (
          <View
            key={p.key}
            className="flex-1 bg-surface rounded-2xl p-3.5 border border-border gap-2"
          >
            <View className={`${ROW} items-center justify-between`}>
              <View className="w-8 h-8 rounded-full items-center justify-center bg-primary-light">
                <Feather name={p.icon} size={16} color={colors.primary} />
              </View>
              <Text className="text-xs font-semibold text-muted">
                {t(`payments.accounts.${p.key}`)}
              </Text>
            </View>

            <MaskedValue
              id={`cashbook:${p.key}`}
              dotClassName="text-lg font-extrabold text-muted"
              dotCount={5}
            >
              <Text
                className={`text-lg font-extrabold text-right ${
                  p.value < 0 ? 'text-danger' : 'text-ink'
                }`}
              >
                {money(p.value, t, lang)}
              </Text>
            </MaskedValue>
          </View>
        ))}
      </View>

      <Text className="text-[11px] text-muted text-center">
        {t('cashbook.totalOnHand', { amount: money(balances.total, t, lang) })}
      </Text>
    </View>
  );
}
