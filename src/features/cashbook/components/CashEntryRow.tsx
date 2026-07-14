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
  /** Long-press to correct a mistake — a mistyped movement is not a fact of business. */
  onLongPress: () => void;
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
 *
 * LONG-PRESS DELETES IT (after a confirm). Deliberately not a swipe and not a
 * button: correcting a movement is rare and destructive, and it must be hard to
 * do by accident while scrolling — but it has to be possible, or a single typo
 * corrupts the drawer balance forever.
 */
export function CashEntryRow({ entry, onLongPress }: CashEntryRowProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className={`${ROW} items-center gap-3 bg-surface rounded-2xl p-3.5 border border-border`}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title} · ${entry.amountLabel}`}
      accessibilityHint={t('payments.delete.title')}
    >
      <View
        className={`w-9 h-9 rounded-full items-center justify-center ${TONE_CHIP[entry.tone]}`}
      >
        <Feather name={entry.icon} size={16} color={TONE_ICON[entry.tone]} />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-ink">{entry.title}</Text>
        <Text className="text-[11px] text-muted">{entry.subtitle}</Text>
        {entry.note ? (
          <Text className="text-[11px] text-muted" numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>

      {/* items-end: the amount column hugs the row's trailing edge, like every
          other money row in the app (SupplierDebtRow, UnpaidExpenseRow). */}
      <View className="items-end gap-1">
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
            // hitSlop, not a bigger box: a 44pt View here would stretch every row
            // that happens to carry a proof and leave the list ragged. The touch
            // target is 12pt of glyph + 16pt of slop on each side = 44pt.
            onPress={() => openAttachment(entry.proof[0])}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={t('payments.proof')}
          >
            <Feather name="paperclip" size={12} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
