import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';

interface DocSummaryCardProps {
  count: number;
  /** Grand total in whole currency units. */
  total: number;
}

/** Item-count chip + grand total footer card. */
export function DocSummaryCard({ count, total }: DocSummaryCardProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');
  return (
    <View className="bg-primary-light rounded-2xl p-4 border border-primary/20 gap-3">
      <View className={`${ROW} items-center justify-between`}>
        <View className="bg-surface px-3 py-1 rounded-lg border border-primary/20">
          <Text className="text-primary text-sm font-extrabold">
            {t('documents.summary.countValue', { n: formatNumber(count, lang) })}
          </Text>
        </View>
        <Text className="text-ink text-sm font-semibold">{t('documents.summary.count')}</Text>
      </View>

      <View className={`${ROW} items-center justify-between pt-3 border-t border-primary/20`}>
        <Text className="text-primary text-lg font-extrabold">
          {formatNumber(total, lang)} <Text className="text-xs font-normal">{currency}</Text>
        </Text>
        <Text className="text-ink text-base font-extrabold">{t('documents.summary.total')}</Text>
      </View>
    </View>
  );
}
