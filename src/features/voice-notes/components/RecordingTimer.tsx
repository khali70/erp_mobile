import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatTime';

interface RecordingTimerProps {
  elapsedMs: number;
  recording: boolean;
}

/** Live `m:ss` elapsed readout with a red dot while recording is in progress. */
export function RecordingTimer({ elapsedMs, recording }: RecordingTimerProps) {
  const { t, i18n } = useTranslation();
  return (
    <View className="items-center gap-2">
      <Text className="text-4xl font-bold text-ink" accessibilityLiveRegion="polite">
        {formatDuration(elapsedMs, i18n.language)}
      </Text>
      <View className="flex-row items-center gap-2">
        {recording && <View className="w-2.5 h-2.5 rounded-full bg-danger" />}
        <Text className="text-xs text-muted">
          {recording ? t('voiceNotes.record.recording') : t('voiceNotes.record.ready')}
        </Text>
      </View>
    </View>
  );
}
