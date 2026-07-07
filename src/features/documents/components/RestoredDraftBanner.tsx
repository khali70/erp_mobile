import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

/** Never-lose-data notice: shown when a draft survived an app relaunch. */
export function RestoredDraftBanner({ onDiscard }: { onDiscard: () => void }) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between bg-primary-light rounded-2xl px-3.5 py-2.5 border border-primary/20`}>
      <Pressable onPress={onDiscard} accessibilityRole="button">
        <Text className="text-danger text-xs font-bold">{t('documents.draft.discard')}</Text>
      </Pressable>
      <View className={`${ROW} items-center gap-1.5 flex-1`}>
        <Text className="text-primary text-xs font-bold text-right flex-1">{t('documents.draft.restored')}</Text>
        <Feather name="rotate-ccw" size={14} color={colors.primary} />
      </View>
    </View>
  );
}
