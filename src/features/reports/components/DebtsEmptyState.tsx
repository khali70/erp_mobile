import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

/**
 * Nobody is owed anything — "لا توجد ديون على المحل. 🎉".
 *
 * This is the ONLY empty state here, and it is good news, not a void: the list
 * is empty precisely because every invoice has been paid. It is drawn in the
 * positive tone for that reason.
 */
export function DebtsEmptyState() {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
      <Feather name="check-circle" size={44} color={colors.positive} />
      <Text className="text-muted text-sm text-center">{t('debts.empty')}</Text>
    </View>
  );
}
