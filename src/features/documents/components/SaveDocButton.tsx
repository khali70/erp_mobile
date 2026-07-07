import { Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

/** Primary save action for a document form. */
export function SaveDocButton({ onPress, saving }: { onPress: () => void; saving: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      className={`${ROW} items-center justify-center gap-2 bg-primary rounded-2xl py-4 ${saving ? 'opacity-60' : ''}`}
      onPress={onPress}
      disabled={saving}
      accessibilityRole="button"
    >
      <Feather name="check" size={18} color={colors.surface} />
      <Text className="text-white text-base font-extrabold">{t('documents.save')}</Text>
    </Pressable>
  );
}
