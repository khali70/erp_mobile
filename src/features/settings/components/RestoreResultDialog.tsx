import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { Dialog } from '@/components/ui/Dialog';

interface RestoreResultDialogProps {
  visible: boolean;
  /** The ledger was restored but its attachments file was not. */
  attachmentsMissing: boolean;
  /** Some voice recordings could not be written back after the swap. */
  voiceRecordingsMissing: boolean;
  onAcknowledge: () => void;
}

/**
 * The success state — and a dead end on purpose.
 *
 * By the time this shows, the live database handles are CLOSED and every
 * hydrated store in the process points at files that have been replaced
 * underneath it. The CTA restarts the app by whatever means this build has (see
 * `requestAppRestart` in ../restore); the dialog is non-dismissible either way,
 * so nobody wanders back into screens that would read from nothing while a
 * restart is still pending.
 */
export function RestoreResultDialog({
  visible,
  attachmentsMissing,
  voiceRecordingsMissing,
  onAcknowledge,
}: RestoreResultDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog visible={visible}>
      <View className={`${ROW} items-center gap-2`}>
        <Feather name="check-circle" size={20} color={colors.positive} />
        <Text className="text-base font-bold text-ink">{t('settings.restore.success.title')}</Text>
      </View>
      <Text className="text-sm text-ink text-right leading-6">
        {t('settings.restore.success.body')}
      </Text>
      {attachmentsMissing && (
        <View className="rounded-2xl bg-warning-light p-3.5">
          <Text className="text-xs text-warning-dark text-right leading-5">
            {t('settings.restore.success.attachmentsMissing')}
          </Text>
        </View>
      )}
      {voiceRecordingsMissing && (
        <View className="rounded-2xl bg-warning-light p-3.5">
          <Text className="text-xs text-warning-dark text-right leading-5">
            {t('settings.restore.success.voiceNotesMissing')}
          </Text>
        </View>
      )}
      <Pressable
        onPress={onAcknowledge}
        accessibilityRole="button"
        className="rounded-xl bg-primary py-3 active:opacity-80"
      >
        <Text className="text-sm font-bold text-surface text-center">
          {t('settings.restore.success.restart')}
        </Text>
      </Pressable>
    </Dialog>
  );
}
