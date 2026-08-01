import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

/** Shown when the review list has no notes for the active filter. */
export function EmptyVoiceNotes() {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
      <Feather name="mic" size={44} color={colors['slate-400']} />
      <Text className="text-muted text-sm text-center">{t('voiceNotes.empty')}</Text>
    </View>
  );
}
