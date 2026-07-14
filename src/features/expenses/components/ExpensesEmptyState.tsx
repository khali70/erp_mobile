import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

interface ExpensesEmptyStateProps {
  /** True when a category chip is hiding rows that DO exist. */
  filtered: boolean;
}

/** No expenses at all — or none in the chosen category. Two different truths. */
export function ExpensesEmptyState({ filtered }: ExpensesEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3">
      <Feather name="file-text" size={40} color={colors.muted} />
      <Text className="text-muted text-sm text-center">
        {t(filtered ? 'expenses.emptyFiltered' : 'expenses.empty')}
      </Text>
    </View>
  );
}
