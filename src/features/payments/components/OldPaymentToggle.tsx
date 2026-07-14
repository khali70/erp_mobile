import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface OldPaymentToggleProps {
  value: boolean;
  onChange: (isOpening: boolean) => void;
}

/**
 * «دفعة قديمة — مش من درج النهارده».
 *
 * THE ANSWER TO THE FIRST BOOT. Debt is derived — invoices minus payments — and
 * the payments table is new, so on the day he upgrades, two years of purchases he
 * settled in cash long ago come back as debt. The app cannot quietly assume they
 * were paid (that would hide the ones he really still owes) and must not pretend
 * they never happened. It can only give him the sentence: "I paid this already,
 * before you existed."
 *
 * ON ⇒ the row is written `ref_kind: 'opening'`: it pays the debt down exactly
 * like a payment, and it is the ONE row kept out of the cash book. Money that left
 * the drawer six months ago must not empty the drawer today — the drawer figure is
 * the one number in the app the owner can check against the notes in his hand.
 *
 * That is also why الحساب and إثبات الدفع vanish behind it in the sheet: there is
 * no pocket to name and no InstaPay screenshot to file for money that moved before
 * the app was installed.
 */
export function OldPaymentToggle({ value, onChange }: OldPaymentToggleProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Pressable
        className={`${ROW} items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border ${
          value ? 'bg-primary-light border-primary' : 'bg-background border-border'
        }`}
        onPress={() => onChange(!value)}
        hitSlop={8}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={t('payments.opening.label')}
      >
        <Text
          className={`flex-1 text-sm font-semibold ${value ? 'text-primary' : 'text-ink'}`}
        >
          {t('payments.opening.label')}
        </Text>

        <View
          className={`w-6 h-6 rounded-lg items-center justify-center border ${
            value ? 'bg-primary border-primary' : 'bg-surface border-border'
          }`}
        >
          {value ? <Feather name="check" size={14} color={colors.surface} /> : null}
        </View>
      </Pressable>

      {/* One line, in his words: what he is recording, and why it does not touch
          today's cash. Without it, a row that settles a debt and moves no cash is
          indistinguishable from a bug. */}
      {value ? <Text className="text-[11px] text-muted leading-4">{t('payments.opening.hint')}</Text> : null}
    </View>
  );
}
