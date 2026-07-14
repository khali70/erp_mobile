import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

/** No money has moved yet — said plainly, and never as a zero pretending to be one. */
export function CashBookEmptyState() {
  const { t } = useTranslation();
  return (
    <View className="items-center justify-center py-16 gap-3">
      <View className="w-16 h-16 rounded-full items-center justify-center bg-primary-light">
        <Feather name="book-open" size={26} color={colors.primary} />
      </View>
      <Text className="text-base font-bold text-ink">{t('cashbook.empty.title')}</Text>
      <Text className="text-xs text-muted text-center px-10">{t('cashbook.empty.body')}</Text>
    </View>
  );
}
