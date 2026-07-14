import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

/**
 * Nobody is owed anything — "مفيش عليك حاجة 🎉".
 *
 * This is the ONLY empty state here, and it is good news, not a void: the list is
 * empty precisely because every invoice and every bill has been paid. It is drawn
 * in the positive tone for that reason.
 *
 * A TITLE AND A BODY, like CashBookEmptyState. One muted line states a fact; the
 * second line TEACHES — it says what will make rows appear here, so that an empty
 * screen reads as "you are square with everyone" and never as "this screen is
 * broken / I have not entered anything and I do not know why".
 */
export function DebtsEmptyState() {
  const { t } = useTranslation();
  return (
    <View className="items-center justify-center py-16 gap-3">
      <View className="w-16 h-16 rounded-full items-center justify-center bg-positive-light">
        <Feather name="check-circle" size={26} color={colors.positive} />
      </View>
      <Text className="text-base font-bold text-ink">{t('debts.emptyTitle')}</Text>
      <Text className="text-xs text-muted text-center px-10">{t('debts.emptyBody')}</Text>
    </View>
  );
}
