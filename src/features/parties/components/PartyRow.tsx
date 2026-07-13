import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { PartyViewModel } from '../presenters';
import { PartyAvatar } from './PartyAvatar';
import { DebtBadge } from './DebtBadge';

interface PartyRowProps {
  party: PartyViewModel;
  debtHint: string;
  onPress: () => void;
}

/** A party card: avatar + name/phone, and an outstanding-balance badge. */
export function PartyRow({ party, debtHint, onPress }: PartyRowProps) {
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3`}>
        <PartyAvatar initial={party.initial} />
        <View className="gap-0.5">
          <Text className="text-sm font-semibold text-ink text-right">{party.name}</Text>
          <View className={`${ROW} items-center gap-1`}>
            <Feather name="phone" size={11} color={colors.muted} />
            <Text className="text-[11px] text-muted font-medium text-right">{party.phoneLabel}</Text>
          </View>
        </View>
      </View>

      <View className="items-end gap-1">
        {party.hasDebt && <Text className="text-[10px] text-muted">{debtHint}</Text>}
        {/* Only an outstanding balance is money — the "settled" label is not,
            so it stays unmasked. */}
        <DebtBadge
          label={party.debtLabel}
          active={party.hasDebt}
          maskId={party.hasDebt ? `party:${party.id}` : undefined}
        />
      </View>
    </Pressable>
  );
}
