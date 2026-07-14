import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';

interface SplitAmountRowProps {
  /** The CASH half, as typed (major units). */
  cashValue: string;
  onChangeCash: (value: string) => void;
  /** The InstaPay half — DERIVED, never typed. Major units. */
  instapayPart: number;
}

/**
 * THE SPLIT: he types the cash he counted; InstaPay is what is left.
 *
 * Only ONE of the two halves is an input, and that is the whole design. A sale
 * must be settled in full — there is no customer-debt book to hold a remainder —
 * so two free fields would let the owner enter a pair that does not add up to
 * the total, and the save would have to reject him for it. Defining the second
 * half as the remainder makes that state UNREACHABLE instead of merely invalid.
 */
export function SplitAmountRow({ cashValue, onChangeCash, instapayPart }: SplitAmountRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <View className="gap-2 bg-background rounded-xl p-3">
      <View className={`${ROW} items-center justify-between`}>
        <TextInput
          value={cashValue}
          onChangeText={onChangeCash}
          keyboardType="numeric"
          selectTextOnFocus
          placeholder="0"
          className="bg-surface text-ink text-sm font-extrabold text-center px-3 py-2 rounded-xl border border-primary/40 min-w-[96px]"
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('payments.accounts.cash')}
        />
        <Text className="text-ink text-sm font-semibold">{t('payments.accounts.cash')}</Text>
      </View>

      <View className={`${ROW} items-center justify-between`}>
        <Text className="text-ink text-sm font-extrabold px-3 py-2">
          {`${formatNumber(instapayPart, lang)} ${t('common.currency')}`}
        </Text>
        <Text className="text-muted text-sm font-semibold">
          {t('payments.accounts.instapay')}
        </Text>
      </View>

      <Text className="text-[11px] text-muted text-right">{t('payments.splitHint')}</Text>
    </View>
  );
}
