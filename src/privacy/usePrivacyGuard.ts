import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { IDLE_MASK_MS, isAnythingRevealed } from './privacy';

/**
 * Root-level privacy lifecycle: applies the start-up mask policy, re-masks when
 * the app leaves the foreground, and re-masks after an idle stretch.
 *
 * Mount exactly ONCE, at the app root (App.tsx). While `privacyMode` is off it
 * registers no AppState listener and no timer.
 */
export function usePrivacyGuard(): void {
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const startMasked = useSettingsStore((s) => s.startMasked);
  const revealed = useUiStore((s) => s.revealed);
  const revealedCards = useUiStore((s) => s.revealedCards);

  // Cold start, and any change to the privacy settings, applies the policy.
  // Turning privacyMode off also drops any stale reveal state, so re-enabling
  // it later starts from a masked slate.
  useEffect(() => {
    const { reveal, maskAll } = useUiStore.getState();
    if (privacyMode && !startMasked) reveal();
    else maskAll();
  }, [privacyMode, startMasked]);

  // Re-mask before the OS snapshots the app for the task switcher.
  useEffect(() => {
    if (!privacyMode) return;
    const onChange = (next: AppStateStatus) => {
      const { reveal, maskAll } = useUiStore.getState();
      if (next === 'background' || next === 'inactive') maskAll();
      else if (next === 'active' && !startMasked) reveal();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [privacyMode, startMasked]);

  // Idle re-mask. `revealedCards` identity changes on every per-value reveal,
  // so this effect re-runs and the timer restarts on each reveal action.
  useEffect(() => {
    if (!privacyMode) return;
    if (!isAnythingRevealed({ revealed, revealedCards })) return;
    const timer = setTimeout(() => useUiStore.getState().maskAll(), IDLE_MASK_MS);
    return () => clearTimeout(timer);
  }, [privacyMode, revealed, revealedCards]);
}
