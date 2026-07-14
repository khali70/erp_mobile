import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import type { SettlementViewModel } from '@/features/reports/presenters';

interface DocumentSettlementCardProps {
  settlement: SettlementViewModel;
}

/** Green = done, amber = part-way, red = untouched. The SAME tones the debts
 *  screen paints this invoice with — one invoice, one colour, everywhere. */
const TONE = {
  settled: {
    icon: 'check-circle',
    color: colors.positive,
    text: 'text-positive',
    chip: 'bg-positive-light',
  },
  partial: {
    icon: 'clock',
    color: colors.warning,
    text: 'text-warning',
    chip: 'bg-warning-light',
  },
  unpaid: {
    icon: 'alert-circle',
    color: colors.danger,
    text: 'text-danger',
    chip: 'bg-danger-light',
  },
} as const;

/**
 * HAVE I PAID THIS INVOICE, AND HOW MUCH IS LEFT ON IT?
 *
 * The one question the owner opens an invoice to answer, and the detail screen
 * could not answer it: it listed the goods, the quantities and the total, and
 * said nothing about money at any point.
 *
 * The status and the "باقي" figure are DERIVED by the FIFO walk in the
 * repository and formatted by the debts screen's own presenter — not
 * re-implemented here. If this card and the debts report ever disagreed about
 * IN-000012, the owner would have no way to tell which one was lying.
 */
export function DocumentSettlementCard({ settlement }: DocumentSettlementCardProps) {
  const { t } = useTranslation();
  const tone = TONE[settlement.status];

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <Text className="text-xs font-bold text-muted text-right">{t('payments.howPaid')}</Text>

      <View className={`${ROW} items-center justify-between`}>
        <View className={`${ROW} items-center gap-2 px-2.5 py-1.5 rounded-xl ${tone.chip}`}>
          <Feather name={tone.icon} size={14} color={tone.color} />
          <Text className={`text-xs font-bold ${tone.text}`}>{settlement.statusLabel}</Text>
        </View>

        {settlement.paidLabel ? (
          <View className={`${ROW} items-center gap-2`}>
            <MaskedValue
              id={`doc:paid:${settlement.id}`}
              dotClassName="text-sm font-extrabold text-muted"
              dotCount={4}
            >
              <Text className="text-sm font-extrabold text-ink">{settlement.paidLabel}</Text>
            </MaskedValue>
            <Text className="text-xs text-muted">{t('payments.paid')}</Text>
          </View>
        ) : null}
      </View>

      {/* "باقي ١٬٠٠٠٫٠٠ ج.م" — what he still owes on THIS invoice. Absent only
          when there is nothing left on it, and then the chip above already says
          so in words. */}
      {settlement.remainingLabel ? (
        <View className={`${ROW} items-center justify-between pt-3 border-t border-border`}>
          <MaskedValue
            id={`doc:remaining:${settlement.id}`}
            dotClassName="text-base font-extrabold text-muted"
            dotCount={4}
          >
            <Text className="text-danger text-base font-extrabold">
              {settlement.remainingLabel}
            </Text>
          </MaskedValue>
          <Text className="text-danger text-sm font-extrabold">{t('payments.remaining')}</Text>
        </View>
      ) : null}
    </View>
  );
}
