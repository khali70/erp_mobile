import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { fromMinor } from '@/utils/money';
import { formatMoneyMajor, formatNumber } from '@/utils/numerals';
import type { StockTotals } from '../utils/stockTotals';

interface StockTotalsBarProps {
  totals: StockTotals;
}

/**
 * The value of whatever the list is currently showing. It sits above the rows
 * and follows the filters, so "value of my t-shirts" is a filter away rather
 * than a separate screen.
 *
 * Cost leads because that is the money already spent; sale value is secondary
 * and muted so the two are never confused at a glance.
 */
export function StockTotalsBar({ totals }: StockTotalsBarProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  // The house money formatter: thousands-grouped, piastres kept, Arabic-Indic
  // digits and ٬ / ٫ separators under `ar`. Never hand-roll this.
  const money = (minor: number) =>
    `${formatMoneyMajor(fromMinor(minor), lang)} ${t('common.currency')}`;

  return (
    <View className="rounded-2xl bg-surface border border-border px-3.5 py-3 gap-1.5">
      <View className={`${ROW} items-end justify-between gap-3`}>
        <View className="flex-1">
          <Text className="text-[11px] font-medium text-muted">{t('inventory.stockTotals.costValue')}</Text>
          <Text className="text-xl font-bold text-ink" numberOfLines={1} adjustsFontSizeToFit>
            {money(totals.costValueMinor)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[11px] font-medium text-muted">{t('inventory.stockTotals.saleValue')}</Text>
          <Text className="text-sm font-bold text-primary" numberOfLines={1}>
            {money(totals.saleValueMinor)}
          </Text>
        </View>
      </View>

      <Text className="text-[11px] text-muted">
        {t('inventory.stockTotals.summary', {
          items: formatNumber(totals.itemCount, lang),
          units: formatNumber(totals.totalQty, lang),
        })}
      </Text>

      {totals.missingCostCount > 0 && (
        <View className={`${ROW} items-center gap-1.5`}>
          <Feather name="alert-triangle" size={12} color={colors.warning} />
          <Text className="text-[11px] font-medium text-warning">
            {t('inventory.stockTotals.missingCost', { count: totals.missingCostCount })}
          </Text>
        </View>
      )}
    </View>
  );
}
