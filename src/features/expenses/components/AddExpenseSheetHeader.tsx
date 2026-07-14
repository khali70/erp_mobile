import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';

interface AddExpenseSheetHeaderProps {
  onClose: () => void;
}

/** Teal head of the "تسجيل نفقة جديدة" sheet. */
export function AddExpenseSheetHeader({ onClose }: AddExpenseSheetHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between bg-primary px-5 py-4`}>
      <View className={`${ROW} items-center gap-2.5`}>
        <Feather name="plus-circle" size={20} color={colors['primary-200']} />
        <Text className="text-white text-base font-extrabold">{t('expenses.add')}</Text>
      </View>

      <Pressable
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: HEADER_OVERLAY }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Feather name="x" size={16} color={colors.surface} />
      </Pressable>
    </View>
  );
}
