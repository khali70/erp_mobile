import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { Dialog } from '@/components/ui/Dialog';
import { isPreFlightFailure } from '../restore-validation';
import type { RestoreError } from '../restore';
import { restoreErrorKey } from '../utils/restore-messages';

interface RestoreErrorDialogProps {
  error: RestoreError;
  onClose: () => void;
}

/**
 * A typed failure, with the reassurance the owner needs first: a pre-flight
 * rejection never touched their data, and a mid-swap failure was rolled back
 * from the safety snapshot. Both are said in words, not implied by a tone.
 */
export function RestoreErrorDialog({ error, onClose }: RestoreErrorDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog visible onClose={onClose}>
      <View className={`${ROW} items-center gap-2`}>
        <Feather name="x-circle" size={20} color={colors.danger} />
        <Text className="text-base font-bold text-ink">{t('settings.restore.error.title')}</Text>
      </View>
      <Text className="text-sm text-ink text-right leading-6">
        {t(restoreErrorKey(error.code, error.actualTarget))}
      </Text>
      {isPreFlightFailure(error.code) && (
        <Text className="text-xs text-positive text-right leading-5 font-semibold">
          {t('settings.restore.error.safe')}
        </Text>
      )}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        className="rounded-xl bg-primary py-3 active:opacity-80"
      >
        <Text className="text-sm font-bold text-surface text-center">
          {t('settings.restore.error.close')}
        </Text>
      </Pressable>
    </Dialog>
  );
}
