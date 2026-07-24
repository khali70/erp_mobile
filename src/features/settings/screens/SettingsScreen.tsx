import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { toLocaleDigits } from '@/utils/numerals';
import { useSettingsStore } from '@/store/settings-store';
import { UpdatesSettingsSection } from '@/features/updates/components/UpdatesSettingsSection';
import { SettingsSwitchRow } from '../components/SettingsSwitchRow';
import { RestoreSection } from '../components/RestoreSection';
import { backupDatabase, BackupError } from '../backup';
import { toMegabytes } from '../utils/file-size';

/**
 * الإعدادات — device settings: the negative-stock policy flag, backup, and the
 * privacy-mode flags (all persisted to MMKV via settings-store).
 * Composition-only; NativeWind styling.
 */
export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);
  const setAllowNegativeStock = useSettingsStore((s) => s.setAllowNegativeStock);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const setPrivacyMode = useSettingsStore((s) => s.setPrivacyMode);
  const startMasked = useSettingsStore((s) => s.startMasked);
  const setStartMasked = useSettingsStore((s) => s.setStartMasked);
  const [backingUp, setBackingUp] = useState(false);

  const onBackup = async () => {
    if (backingUp) return;
    setBackingUp(true);
    try {
      await backupDatabase();
    } catch (e) {
      // A `too-large` refusal is the one failure the owner can DO something
      // about, so it gets its own sentence with the numbers in it rather than a
      // raw error string nobody can act on.
      const message =
        e instanceof BackupError
          ? t('settings.backup.errorTooLarge', {
              size: toLocaleDigits(toMegabytes(e.totalBytes), i18n.language),
              limit: toLocaleDigits(toMegabytes(e.limitBytes), i18n.language),
            })
          : String(e instanceof Error ? e.message : e);
      Alert.alert(t('settings.backup.errorTitle'), message);
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="gap-3 pb-24">
        <Text className="text-xs font-bold text-muted px-1">{t('settings.stock.section')}</Text>

        <SettingsSwitchRow
          label={t('settings.negativeStock.label')}
          hint={t('settings.negativeStock.hint')}
          value={allowNegativeStock}
          onValueChange={setAllowNegativeStock}
        />

        <Text className="text-xs font-bold text-muted px-1 mt-3">
          {t('settings.privacy.section')}
        </Text>

        <SettingsSwitchRow
          label={t('settings.privacy.privacyMode.label')}
          hint={t('settings.privacy.privacyMode.hint')}
          value={privacyMode}
          onValueChange={setPrivacyMode}
        />

        {/* Sub-setting: meaningless while privacy mode is off, so it dims out. */}
        <SettingsSwitchRow
          label={t('settings.privacy.startMasked.label')}
          hint={t('settings.privacy.startMasked.hint')}
          value={startMasked}
          onValueChange={setStartMasked}
          disabled={!privacyMode}
        />

        <Text className="text-xs font-bold text-muted px-1 mt-3">{t('settings.data.section')}</Text>

        <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
          <View className="gap-1">
            <Text className="text-sm font-bold text-ink text-right">
              {t('settings.backup.label')}
            </Text>
            <Text className="text-xs text-muted text-right leading-5">
              {t('settings.backup.hint')}
            </Text>
          </View>
          <Pressable
            onPress={onBackup}
            disabled={backingUp}
            accessibilityRole="button"
            accessibilityLabel={t('settings.backup.button')}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-80"
            style={{ opacity: backingUp ? 0.6 : 1 }}
          >
            {backingUp ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Feather name="download" size={18} color={colors.surface} />
            )}
            <Text className="text-sm font-bold text-surface">
              {backingUp ? t('settings.backup.working') : t('settings.backup.button')}
            </Text>
          </Pressable>
        </View>
        {/* The inverse of backup, and the app's only irreversible action — its
            whole flow (row, confirm, progress, result) lives in one component. */}
        <RestoreSection />
        <UpdatesSettingsSection />
      </ScrollView>
    </View>
  );
}
