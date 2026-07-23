import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

/**
 * Stands in for the restore row once a restore has landed in this session.
 *
 * The database handle is closed and the process is running on stale state, so
 * offering "restore" again — or anything that looks routine — would be a lie.
 * This says the one true thing left: close the app and open it again.
 */
export function RestoreRestartBanner() {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-4 border border-positive gap-2">
      <View className={`${ROW} items-center gap-2`}>
        <Feather name="check-circle" size={18} color={colors.positive} />
        <Text className="text-sm font-bold text-ink">{t('settings.restore.success.title')}</Text>
      </View>
      <Text className="text-xs text-muted text-right leading-5">
        {t('settings.restore.success.body')}
      </Text>
    </View>
  );
}
