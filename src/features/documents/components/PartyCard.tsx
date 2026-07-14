import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatMoneyMajor } from '@/utils/numerals';
import type { Party } from '../types';

interface PartyCardProps {
  /** i18n namespace of the owning mode (documents.outgoing | documents.incoming). */
  ns: string;
  party: Party | null;
  isWalkIn: boolean;
  partyLabel: string;
  /** Show the outstanding-debt line (purchase/supplier only). */
  showDebt?: boolean;
  onOpen: () => void;
  onQuickAdd: () => void;
}

/** Party (customer/supplier) selector card with optional outstanding-debt note. */
export function PartyCard({ ns, party, isWalkIn, partyLabel, showDebt, onOpen, onQuickAdd }: PartyCardProps) {
  const { t, i18n } = useTranslation();
  const currency = t('common.currency');
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <View className={`${ROW} items-center justify-between`}>
        <Pressable className={`${ROW} items-center gap-1.5`} onPress={onQuickAdd}>
          <Feather name="user-plus" size={16} color={colors.primary} />
          <Text className="text-primary text-sm font-extrabold">{t(`${ns}.addParty`)}</Text>
        </Pressable>
        <Text className="text-muted text-sm font-semibold">{t(`${ns}.party`)}</Text>
      </View>

      <Pressable
        className={`${ROW} items-center justify-between bg-background rounded-xl px-3.5 py-3 border border-border`}
        onPress={onOpen}
      >
        <Feather name="chevron-down" size={18} color={colors.muted} />
        <View className={`${ROW} items-center gap-2`}>
          <Text className={`text-sm font-extrabold ${party || isWalkIn ? 'text-primary' : 'text-muted'}`}>
            {partyLabel}
          </Text>
          <Feather name="user" size={18} color={colors.muted} />
        </View>
      </Pressable>

      {/* Supplier debt (AP) is informational only; customers carry no balance
          (sales are cash, paid in full — no AR by design). */}
      {showDebt && party && party.debt > 0 && (
        <Text className="text-warning-dark text-xs font-bold text-right">
          {t(`${ns}.prevDebt`)}: {formatMoneyMajor(party.debt, i18n.language)} {currency}
        </Text>
      )}
    </View>
  );
}
