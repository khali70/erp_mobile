import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';
import { PartyAvatar } from '@/features/parties/components/PartyAvatar';
import type { SupplierDebtViewModel } from '../presenters';

interface SupplierDebtRowProps {
  debt: SupplierDebtViewModel;
  onPress: () => void;
}

/**
 * One supplier the shop owes: name, phone, what is owed, and HOW LONG it has
 * been outstanding.
 *
 * The age is the point of this row. "٤٬٠٠٠ ج.م" tells the owner what he owes;
 * "منذ ٤٥ يوم" tells him whether he can still look the man in the eye — and it
 * turns red once the debt is old enough to be a problem rather than a fact of
 * business.
 */
export function SupplierDebtRow({ debt, onPress }: SupplierDebtRowProps) {
  const ageTone = debt.overdue ? 'text-danger' : 'text-muted';
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3 flex-1`}>
        <PartyAvatar initial={debt.initial} />
        <View className="gap-0.5 flex-1">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {debt.name}
          </Text>
          <View className={`${ROW} items-center gap-1`}>
            <Feather name="phone" size={11} color={colors.muted} />
            <Text className="text-[11px] text-muted font-medium">{debt.phoneLabel}</Text>
          </View>
        </View>
      </View>

      <View className="items-end gap-1">
        <MaskedValue
          id={`debt:${debt.id}`}
          dotClassName="text-sm font-extrabold text-muted"
          iconSize={13}
          dotCount={4}
        >
          <Text className="text-sm font-extrabold text-danger">{debt.owedLabel}</Text>
        </MaskedValue>
        <View className={`${ROW} items-center gap-1`}>
          <Feather
            name="clock"
            size={10}
            color={debt.overdue ? colors.danger : colors.muted}
          />
          <Text className={`text-[11px] font-medium ${ageTone}`}>{debt.ageLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}
