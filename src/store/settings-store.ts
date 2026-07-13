import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkv';

// Durable device settings (single local store, no auth). Persisted to MMKV so a
// cold start restores them. Money/data-integrity flags live here, NOT in SQLite.
type SettingsState = {
  /**
   * When false (default), posting an outgoing document that would drive an
   * item's on-hand below zero is BLOCKED. When true, the same post succeeds and
   * on-hand may go negative. Owner-controlled from the list header / settings.
   */
  allowNegativeStock: boolean;
  setAllowNegativeStock: (v: boolean) => void;

  /**
   * Privacy mode — when true, money aggregates (KPI figures, party balances)
   * render as a dot-run until revealed. Presentation only: nothing is filtered
   * or gated in the data layer. Off by default → zero visual change.
   */
  privacyMode: boolean;
  setPrivacyMode: (v: boolean) => void;

  /**
   * Mask on every cold start and on resume from background. Only meaningful
   * while `privacyMode` is on. Defaults to true — the safe side of the toggle.
   */
  startMasked: boolean;
  setStartMasked: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      allowNegativeStock: false,
      setAllowNegativeStock: (allowNegativeStock) => set({ allowNegativeStock }),
      privacyMode: false,
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      startMasked: true,
      setStartMasked: (startMasked) => set({ startMasked }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
