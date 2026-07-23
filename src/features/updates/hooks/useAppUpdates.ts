import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';
import { useUpdatesStore } from '@/store/updates-store';
import type { AppUpdates, UpdateStatus } from '../types';

/**
 * THE single owner of every expo-updates call. No component ever touches
 * `Updates.*`; they consume this hook (via UpdatesProvider's context) and read
 * plain state + call plain callbacks.
 *
 * The whole surface is guarded by `Updates.isEnabled`, which is false in dev and
 * in Expo Go. There, every action is an inert no-op that lands on the
 * `unavailable` status instead of throwing — the feature simply disappears.
 *
 * Unmount safety: an in-flight download can outlive the screen. `mounted` gates
 * every post-await `setState`, so a check begun on Settings and finished after
 * the user navigated away never warns about setting state on a dead component.
 */
export function useAppUpdates(): AppUpdates {
  const { t } = useTranslation();

  const enabled = Updates.isEnabled;
  const [status, setStatus] = useState<UpdateStatus>(enabled ? 'idle' : 'unavailable');
  const [error, setError] = useState<string | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);

  const lastCheckedAt = useUpdatesStore((s) => s.lastCheckedAt);
  const setLastCheckedAt = useUpdatesStore((s) => s.setLastCheckedAt);
  const setCurrentMeta = useUpdatesStore((s) => s.setCurrentMeta);
  const cachedChannel = useUpdatesStore((s) => s.currentChannel);
  const cachedUpdateId = useUpdatesStore((s) => s.currentUpdateId);

  // `useUpdates()` is the reactive source of the pending flag: a downloaded-but-
  // not-yet-applied update stays pending across the app's life and applies on the
  // next cold start on its own.
  const { isUpdatePending } = Updates.useUpdates();

  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Cache the running build's metadata once, so the Settings row can render the
  // version + channel even with no connectivity.
  useEffect(() => {
    if (enabled) setCurrentMeta(Updates.updateId ?? null, Updates.channel ?? null);
  }, [enabled, setCurrentMeta]);

  const toError = useCallback(
    (e: unknown) => {
      if (!mounted.current) return;
      setStatus('error');
      setError(e instanceof Error ? e.message : t('updates.status.error'));
    },
    [t],
  );

  const check = useCallback(async () => {
    if (!enabled) {
      setStatus('unavailable');
      return;
    }
    // Rapid double-tap is idempotent: a run already in flight owns the machine.
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!mounted.current) return;
      setLastCheckedAt(Date.now());
      if (!result.isAvailable) {
        setStatus('upToDate');
        return;
      }
      // A runtimeVersion mismatch surfaces here as `isAvailable === false`, so
      // this branch only runs for a genuinely compatible update.
      setStatus('available');
      setStatus('downloading');
      await Updates.fetchUpdateAsync();
      if (!mounted.current) return;
      setStatus('readyToReload');
      setPromptVisible(true);
    } catch (e) {
      toError(e);
    } finally {
      inFlight.current = false;
    }
  }, [enabled, setLastCheckedAt, toError]);

  const restart = useCallback(async () => {
    if (!enabled) return;
    try {
      await Updates.reloadAsync();
    } catch (e) {
      toError(e);
    }
  }, [enabled, toError]);

  const dismissPrompt = useCallback(() => setPromptVisible(false), []);

  const versionLabel = enabled
    ? ((Updates.updateId ?? cachedUpdateId)?.slice(0, 8) ?? 'embedded')
    : (cachedUpdateId?.slice(0, 8) ?? 'embedded');

  return {
    status,
    error,
    isUpdatePending,
    isEnabled: enabled,
    lastCheckedAt,
    channel: (enabled ? Updates.channel : cachedChannel) ?? cachedChannel ?? null,
    versionLabel,
    promptVisible,
    check,
    restart,
    dismissPrompt,
  };
}
