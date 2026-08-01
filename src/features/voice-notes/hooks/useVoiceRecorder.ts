import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { persistRecording, deleteFileQuietly } from '../utils/persistRecording';
import type { MicPermission, PersistedRecording } from '../types';

// A tap that never became a recording is not a note. Below this the stop path
// throws it away rather than saving a silent blip the owner would have to hunt
// down and delete later.
const MIN_DURATION_MS = 1000;
const MIME = 'audio/m4a';

export interface VoiceRecorder {
  permission: MicPermission;
  isRecording: boolean;
  /** Live elapsed length of the in-progress recording, in ms. */
  elapsedMs: number;
  /** Input level 0..1 for a simple meter, or null when metering is unavailable. */
  level: number | null;
  /** Request mic access + begin recording. Resolves false if permission denied. */
  start: () => Promise<boolean>;
  /** Stop, persist to local storage, and return the note metadata — or null if
   *  the clip was too short (it is discarded). */
  stop: () => Promise<PersistedRecording | null>;
  /** Abort the in-progress recording and drop its bytes. */
  cancel: () => Promise<void>;
}

/**
 * THE single owner of every expo-audio RECORDING call — mirrors how
 * useAppUpdates owns expo-updates. No component touches the recorder; they call
 * these plain callbacks and read plain state.
 *
 * The whole surface is guarded by microphone permission: a denied mic lands on
 * `permission: 'denied'` and every action is an inert no-op instead of throwing,
 * so the screen degrades to a clear message with no red box.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Poll the recorder ~4x/sec for the live timer + meter. Cheap, and it is the
  // supported way to read progress without wiring a status listener.
  const state = useAudioRecorderState(recorder, 250);

  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Read the current grant WITHOUT prompting, so a returning user who already
    // granted the mic sees the record button live immediately.
    getRecordingPermissionsAsync()
      .then((res) => {
        if (mounted.current) setPermission(res.granted ? 'granted' : res.status as MicPermission);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    const res = await requestRecordingPermissionsAsync();
    if (!res.granted) {
      if (mounted.current) setPermission('denied');
      return false;
    }
    if (mounted.current) setPermission('granted');
    // Recording needs the session in record mode; playsInSilentMode so a phone
    // on silent still records (and later plays back) as the owner expects.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  const teardownMode = useCallback(async () => {
    // Hand the audio session back so playback and the rest of the app behave
    // normally once we are no longer recording. Keep `playsInSilentMode: true`:
    // omitting it resets the native flag to false, which then silently blocks
    // playback on a phone that is on silent/vibrate (native `play()` returns
    // early with no error) — the "play button does nothing" bug.
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // Non-fatal — the next start() sets the mode again anyway.
    }
  }, []);

  const stop = useCallback(async () => {
    const durationMs = state.durationMillis;
    await recorder.stop();
    const uri = recorder.uri;
    await teardownMode();
    if (!uri || durationMs < MIN_DURATION_MS) {
      // Too short (or nothing recorded): drop the cache file, save nothing.
      if (uri) deleteFileQuietly(uri);
      return null;
    }
    const persisted = persistRecording(uri, MIME);
    return { ...persisted, durationMs };
  }, [recorder, state.durationMillis, teardownMode]);

  const cancel = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // Already stopped — nothing to abort.
    }
    await teardownMode();
    const uri = recorder.uri;
    if (uri) deleteFileQuietly(uri);
  }, [recorder, teardownMode]);

  return {
    permission,
    isRecording: state.isRecording,
    elapsedMs: state.durationMillis,
    level: state.metering ?? null,
    start,
    stop,
    cancel,
  };
}
