import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { useInterruptedRestore } from '../hooks/useInterruptedRestore';

interface RestoreRecoveryScreenProps {
  /** Called when the app may boot normally (the owner kept what is on disk). */
  onResolved: () => void;
}

/**
 * Shown INSTEAD of the app when a restore was interrupted — before migrations
 * run, before any screen reads a row. The file at the live path may be half
 * written, and booting onto it either crashes on first read or, worse, does not.
 *
 * Two ways out and no third: put the pre-restore snapshot back (then restart),
 * or accept what is on disk and continue. The app never decides this silently —
 * it is the owner's data either way.
 */
export function RestoreRecoveryScreen({ onResolved }: RestoreRecoveryScreenProps) {
  const { t } = useTranslation();
  const { phase, canRollback, rollback, keepCurrent } = useInterruptedRestore();

  const onKeep = () => {
    keepCurrent();
    onResolved();
  };

  if (phase === 'working') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm font-bold text-ink text-center">
          {t('settings.restore.recovery.working')}
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === 'rolled-back' || phase === 'failed') {
    const ok = phase === 'rolled-back';
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-8">
        <Feather
          name={ok ? 'check-circle' : 'x-circle'}
          size={32}
          color={ok ? colors.positive : colors.danger}
        />
        <Text className="text-base font-bold text-ink text-center">
          {t(ok ? 'settings.restore.recovery.doneTitle' : 'settings.restore.recovery.failedTitle')}
        </Text>
        <Text className="text-sm text-muted text-center leading-6">
          {t(ok ? 'settings.restore.recovery.doneBody' : 'settings.restore.recovery.failedBody')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-6">
      <View className="bg-surface rounded-3xl p-5 gap-3 border border-border">
        <View className={`${ROW} items-center gap-2`}>
          <Feather name="alert-triangle" size={20} color={colors.warning} />
          <Text className="text-base font-bold text-ink">
            {t('settings.restore.recovery.title')}
          </Text>
        </View>
        <Text className="text-sm text-ink text-right leading-6">
          {t('settings.restore.recovery.body')}
        </Text>

        {canRollback ? (
          <Pressable
            onPress={rollback}
            accessibilityRole="button"
            className="rounded-xl bg-primary py-3 active:opacity-80"
          >
            <Text className="text-sm font-bold text-surface text-center">
              {t('settings.restore.recovery.rollback')}
            </Text>
          </Pressable>
        ) : (
          <Text className="text-xs text-danger text-right leading-5 font-semibold">
            {t('settings.restore.recovery.unavailable')}
          </Text>
        )}

        <Pressable onPress={onKeep} accessibilityRole="button" className="py-2 active:opacity-70">
          <Text className="text-sm font-bold text-muted text-center">
            {t('settings.restore.recovery.keep')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
