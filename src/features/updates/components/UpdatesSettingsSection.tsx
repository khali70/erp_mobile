import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUpdatesStore } from '@/store/updates-store';
import { useAppUpdatesContext } from '../hooks/useAppUpdatesContext';
import { UpdateStatusRow } from './UpdateStatusRow';
import { AutoUpdateToggleRow } from './AutoUpdateToggleRow';

/**
 * The whole "App updates" Settings section — the ONLY place the OTA feature and
 * the Settings screen meet. It wires the shared updates context and the prefs
 * store to two presentational rows, so SettingsScreen stays composition-only.
 *
 * Inline section, not a dedicated route: the UX is two rows and a sheet — too
 * small to earn a screen + a RootStackParamList entry, and it belongs beside the
 * other device toggles it visually matches.
 */
export function UpdatesSettingsSection() {
  const { t } = useTranslation();
  const { status, error, isEnabled, versionLabel, channel, lastCheckedAt, check } =
    useAppUpdatesContext();
  const autoCheckOnLaunch = useUpdatesStore((s) => s.autoCheckOnLaunch);
  const setAutoCheckOnLaunch = useUpdatesStore((s) => s.setAutoCheckOnLaunch);

  return (
    <>
      <Text className="text-xs font-bold text-muted px-1 mt-3">{t('updates.section')}</Text>

      <UpdateStatusRow
        status={status}
        error={error}
        isEnabled={isEnabled}
        versionLabel={versionLabel}
        channel={channel}
        lastCheckedAt={lastCheckedAt}
        onCheck={check}
      />

      <AutoUpdateToggleRow
        value={autoCheckOnLaunch}
        onValueChange={setAutoCheckOnLaunch}
        disabled={!isEnabled}
      />
    </>
  );
}
