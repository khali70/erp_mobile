import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import type { AccountTotals } from '@/repositories/transaction-repository';
import { money } from '../presenters';

interface DailySalesCardProps {
  sales: AccountTotals;
}

/**
 * مبيعات اليوم — CASH VERSUS INSTAPAY.
 *
 * The question the owner asks at closing time, right before he counts the
 * drawer: how much did I sell today, and how much of it should be sitting in
 * front of me in notes?
 *
 * These figures are summed from the TRANSACTIONS (`ref_kind='sale'`, filtered on
 * `occurred_at`), never from `documents` — a document has no `account` and
 * cannot say which pocket the money landed in. For a sale split across both, the
 * answer is literally "both", and only the transaction rows know the split.
 */
export function DailySalesCard({ sales }: DailySalesCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const rows = [
    { key: 'cash' as const, value: sales.cash },
    { key: 'instapay' as const, value: sales.instapay },
  ];

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <View className={`${ROW} items-center justify-between`}>
        <MaskedValue
          id="cashbook:salesToday"
          dotClassName="text-base font-extrabold text-muted"
          dotCount={5}
        >
          <Text className="text-base font-extrabold text-positive">
            {money(sales.total, t, lang)}
          </Text>
        </MaskedValue>

        <View className={`${ROW} items-center gap-2`}>
          <Feather name="trending-up" size={16} color={colors.positive} />
          <Text className="text-sm font-bold text-ink">{t('cashbook.salesToday')}</Text>
        </View>
      </View>

      <View className="h-px bg-border" />

      <View className={`${ROW} justify-between`}>
        {rows.map((r) => (
          <View key={r.key} className="flex-1 gap-1">
            <Text className="text-[11px] text-muted text-center">
              {t(`payments.accounts.${r.key}`)}
            </Text>
            <MaskedValue
              id={`cashbook:salesToday:${r.key}`}
              dotClassName="text-sm font-bold text-muted"
              dotCount={4}
            >
              <Text className="text-sm font-bold text-ink text-center">
                {money(r.value, t, lang)}
              </Text>
            </MaskedValue>
          </View>
        ))}
      </View>
    </View>
  );
}
