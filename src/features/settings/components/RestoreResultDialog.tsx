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
  onAcknowledge: () => void;
}

/**
 * The success state — and a dead end on purpose.
 *
 * By the time this shows, the live database handle is CLOSED and every hydrated
 * store in the process points at a file that has been replaced underneath it.
 * There is no `expo-updates` in this project to reload with (see
 * `CAN_RELOAD_PROGRAMMATICALLY` in ../restore), so the dialog is
 * non-dismissible and asks the owner to fully close and reopen the app rather
 * than letting them wander back into screens that would read from nothing.
 */
export function RestoreResultDialog({
  visible,
  attachmentsMissing,
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
