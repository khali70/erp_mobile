import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface UpdatePromptSheetProps {
  visible: boolean;
  onRestart: () => void;
  onLater: () => void;
}

/**
 * Non-blocking "update ready" sheet — a dismissible BottomSheet, never a native
 * Alert. "Later" keeps the update staged; it applies on the next cold start on
 * its own, so nothing is lost by deferring.
 */
export function UpdatePromptSheet({ visible, onRestart, onLater }: UpdatePromptSheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onLater} className="min-h-0 p-6 gap-5">
      <View className="items-center gap-3 pt-2">
        <View className="w-14 h-14 rounded-full bg-primary-light items-center justify-center">
          <Feather name="download-cloud" size={26} color={colors.primary} />
        </View>
        <Text className="text-lg font-bold text-ink text-center">{t('updates.prompt.title')}</Text>
        <Text className="text-sm text-muted text-center leading-6">
          {t('updates.prompt.body')}
        </Text>
      </View>

      <View className="gap-3">
        <Pressable
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel={t('updates.prompt.restart')}
          className={`${ROW} items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80`}
        >
          <Feather name="refresh-cw" size={18} color={colors.surface} />
          <Text className="text-sm font-bold text-surface">{t('updates.prompt.restart')}</Text>
        </Pressable>
        <Pressable
          onPress={onLater}
          accessibilityRole="button"
          accessibilityLabel={t('updates.prompt.later')}
          className="items-center justify-center rounded-xl border border-border py-3.5 active:opacity-70"
        >
          <Text className="text-sm font-bold text-muted">{t('updates.prompt.later')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
