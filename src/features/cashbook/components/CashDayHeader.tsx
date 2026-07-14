import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import type { DayTone, LedgerDayViewModel } from '../presenters';

interface CashDayHeaderProps {
  day: LedgerDayViewModel;
}

/** A day that did not move a pocket is neither a gain nor a loss — it is quiet. */
const TONE_TEXT: Record<DayTone, string> = {
  up: 'text-positive',
  down: 'text-danger',
  flat: 'text-muted',
};

/**
 * One day of the ledger, and what each pocket did in it.
 *
 * Both pockets always show, even at zero: a day where the drawer did not move
 * is information, not an absence of it. And the two are never added together —
 * the day the owner reconciles, he counts the drawer against `cash` and opens
 * the InstaPay app for the other.
 */
export function CashDayHeader({ day }: CashDayHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between px-1 pt-2 pb-1`}>
      <View className={`${ROW} items-center gap-3`}>
        <Text className={`text-[11px] font-bold ${TONE_TEXT[day.cashTone]}`}>
          {`${t('payments.accounts.cash')} ${day.cashLabel}`}
        </Text>
        <Text className={`text-[11px] font-bold ${TONE_TEXT[day.instapayTone]}`}>
          {`${t('payments.accounts.instapay')} ${day.instapayLabel}`}
        </Text>
      </View>

      <Text className="text-xs font-extrabold text-ink">{day.dateLabel}</Text>
    </View>
  );
}
