import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { RecordButton } from './RecordButton';
import { RecordingTimer } from './RecordingTimer';
import type { PersistedRecording } from '../types';

interface RecordFabProps {
  /** Handed a persisted recording when a kept clip is stopped. */
  onCaptured: (rec: PersistedRecording) => void;
}

/**
 * The ONE primary capture control: a large centered record button that records
 * on the fly. It owns a single `useVoiceRecorder`, so tapping toggles start/stop
 * inline with no sheet. A too-short take is discarded by the recorder's
 * MIN_DURATION_MS guard and surfaced as a hint; a denied mic degrades to a plain
 * message, never a crash. Only the parent persists the note (via `onCaptured`).
 */
export function RecordFab({ onCaptured }: RecordFabProps) {
  const { t } = useTranslation();
  const rec = useVoiceRecorder();
  const [tooShort, setTooShort] = useState(false);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const denied = rec.permission === 'denied';

  // Breathing pulse while recording, so the red button reads as live.
  useEffect(() => {
    if (!rec.isRecording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rec.isRecording, pulse]);

  const handlePress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (rec.isRecording) {
        const captured = await rec.stop();
        if (captured) {
          setTooShort(false);
          onCaptured(captured);
        } else {
          // Below MIN_DURATION_MS — nothing saved; tell the owner why.
          setTooShort(true);
        }
      } else {
        setTooShort(false);
        await rec.start();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, rec, onCaptured]);

  if (denied) {
    return (
      <View className="items-center gap-2 py-3">
        <Text className="text-xs text-muted text-center px-6">
          {t('voiceNotes.record.permissionDenied')}
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center gap-2 py-2">
      {rec.isRecording && <RecordingTimer elapsedMs={rec.elapsedMs} recording />}
      {tooShort && !rec.isRecording && (
        <Text className="text-xs text-warning-dark text-center">
          {t('voiceNotes.record.tooShort')}
        </Text>
      )}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <RecordButton recording={rec.isRecording} disabled={busy} onPress={handlePress} />
      </Animated.View>
    </View>
  );
}
