import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { openAttachment } from '@/utils/attachments';
import type { LedgerEntryViewModel, LedgerTone } from '../presenters';

interface CashEntryRowProps {
  entry: LedgerEntryViewModel;
}

/** Money in is green, money out is red — and a transfer is NEITHER. */
const TONE_TEXT: Record<LedgerTone, string> = {
  in: 'text-positive',
  out: 'text-danger',
  neutral: 'text-ink',
};

const TONE_CHIP: Record<LedgerTone, string> = {
  in: 'bg-positive-light',
  out: 'bg-danger-light',
  neutral: 'bg-background',
};

const TONE_ICON: Record<LedgerTone, string> = {
  in: colors.positive,
  out: colors.danger,
  neutral: colors.muted,
};

/**
 * One movement of money, and WHY it moved.
 *
 * The "why" is the row's title, not a footnote: a bare list of amounts is a bank
 * statement, and the owner cannot reconcile a bank statement against his memory
 * of the day. "سداد لمورد" / "بيع" / "سحب شخصي" is what makes a figure checkable.
 *
 * A transfer renders as ONE row (نقدي ← إنستاباي) with no + or −, because it is
 * the same money in another pocket — not a loss and not a gain.
 */
export function CashEntryRow({ entry }: CashEntryRowProps) {
  const { t } = useTranslation();

  return (
    <View className={`${ROW} items-center gap-3 bg-surface rounded-2xl p-3.5 border border-border`}>
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${TONE_CHIP[entry.tone]}`}
      >
        <Feather name={entry.icon} size={16} color={TONE_ICON[entry.tone]} />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-ink text-right">{entry.title}</Text>
        <Text className="text-[11px] text-muted text-right">{entry.subtitle}</Text>
        {entry.note ? (
          <Text className="text-[11px] text-muted text-right" numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>

      <View className="items-start gap-1">
        <MaskedValue
          id={`cashbook:entry:${entry.id}`}
          dotClassName="text-sm font-extrabold text-muted"
          dotCount={4}
        >
          <Text className={`text-sm font-extrabold ${TONE_TEXT[entry.tone]}`}>
            {entry.amountLabel}
          </Text>
        </MaskedValue>

        {entry.proof.length > 0 ? (
          <Pressable
            onPress={() => openAttachment(entry.proof[0])}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('payments.proof')}
          >
            <Feather name="paperclip" size={12} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
