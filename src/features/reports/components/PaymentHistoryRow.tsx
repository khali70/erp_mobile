import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { openAttachment } from '@/utils/attachments';
import type { PaymentViewModel } from '../presenters';

interface PaymentHistoryRowProps {
  payment: PaymentViewModel;
}

/**
 * One payment: when, how much, out of WHICH POCKET, and its proof.
 *
 * MONEY OUT — red, arrow-up-right. This is the shop PAYING a supplier, the same
 * event the cash book renders as an outflow, and it must not read as income here
 * just because the screen it sits on is called "debts". Green + arrow-in on one
 * screen and red + arrow-out on another, for the same transaction, is how a man
 * stops believing either of them.
 *
 * The proof chip is tappable — an InstaPay transfer IS a screenshot, and this is
 * where the owner produces it when the supplier says the money never arrived.
 * Cash rows have none, by design: the money was handed over and both men saw it.
 */
export function PaymentHistoryRow({ payment }: PaymentHistoryRowProps) {
  return (
    <View className="bg-surface rounded-[18px] p-3.5 border border-border gap-2">
      <View className={`${ROW} items-center justify-between`}>
        <View className={`${ROW} items-center gap-3 flex-1`}>
          <View className="w-8 h-8 rounded-xl items-center justify-center bg-danger-light">
            <Feather name="arrow-up-right" size={15} color={colors.danger} />
          </View>
          <View className="gap-0.5 flex-1">
            <Text className="text-sm font-bold text-ink">{payment.amountLabel}</Text>
            <Text className="text-[11px] text-muted">{payment.dateLabel}</Text>
          </View>
        </View>

        <View className="px-2.5 py-1 rounded-lg border border-border bg-background">
          <Text className="text-[11px] font-medium text-muted">{payment.accountLabel}</Text>
        </View>
      </View>

      {payment.note ? <Text className="text-[11px] text-muted">{payment.note}</Text> : null}

      {payment.proof.map((a) => (
        <Pressable
          key={a.id}
          className={`${ROW} items-center gap-2 bg-background rounded-xl px-3 py-2`}
          onPress={() => openAttachment(a)}
          accessibilityRole="button"
        >
          <Feather name="image" size={14} color={colors.muted} />
          <Text className="text-ink text-xs flex-1" numberOfLines={1}>
            {a.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
