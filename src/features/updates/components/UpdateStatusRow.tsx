import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { UpdateStatus } from '../types';
import { relativeTime } from '../utils/relativeTime';

interface UpdateStatusRowProps {
  status: UpdateStatus;
  error: string | null;
  isEnabled: boolean;
  versionLabel: string;
  channel: string | null;
  lastCheckedAt: number | null;
  onCheck: () => void;
}

const BUSY: UpdateStatus[] = ['checking', 'downloading'];

/**
 * The manual "Check for updates" row — presentational only, every value arrives
 * as a prop. Tapping re-checks (including when already up-to-date). Busy states
 * show a spinner and swallow taps; `unavailable` (dev / Expo Go) is inert.
 */
export function UpdateStatusRow({
  status,
  error,
  isEnabled,
  versionLabel,
  channel,
  lastCheckedAt,
  onCheck,
}: UpdateStatusRowProps) {
  const { t } = useTranslation();
  const busy = BUSY.includes(status);
  const inert = !isEnabled || busy;

  const subtitle = (() => {
    switch (status) {
      case 'unavailable':
        return t('updates.status.unavailable');
      case 'checking':
        return t('updates.status.checking');
      case 'downloading':
        return t('updates.status.downloading');
      case 'available':
        return t('updates.status.available');
      case 'readyToReload':
        return t('updates.status.ready');
      case 'error':
        return error ?? t('updates.status.error');
      case 'upToDate':
        return t('updates.status.upToDate');
      default:
        return t('updates.status.idle');
    }
  })();

  const metaLine = (() => {
    if (!isEnabled) return null;
    const parts: string[] = [];
    if (channel) parts.push(t('updates.meta.version', { version: versionLabel, channel }));
    if (lastCheckedAt) {
      const rel = relativeTime(lastCheckedAt, Date.now());
      parts.push(t('updates.lastChecked.label', { value: t(rel.key, { count: rel.count }) }));
    }
    return parts.length ? parts.join(' · ') : null;
  })();

  return (
    <Pressable
      onPress={onCheck}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={t('updates.check.button')}
      accessibilityState={{ disabled: inert }}
      className="bg-surface rounded-2xl p-4 border border-border active:opacity-80"
      style={{ opacity: isEnabled ? 1 : 0.6 }}
    >
      <View className={`${ROW} items-center justify-between gap-4`}>
        <View className="flex-1 gap-1">
          <Text className="text-sm font-bold text-ink text-right">
            {t('updates.check.label')}
          </Text>
          <Text
            className="text-xs text-right leading-5"
            style={{ color: status === 'error' ? colors.danger : colors.muted }}
          >
            {subtitle}
          </Text>
          {metaLine && (
            <Text className="text-[11px] text-muted text-right leading-4">{metaLine}</Text>
          )}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather
            name={status === 'error' ? 'rotate-cw' : 'refresh-cw'}
            size={18}
            color={isEnabled ? colors.primary : colors.muted}
          />
        )}
      </View>
    </Pressable>
  );
}
