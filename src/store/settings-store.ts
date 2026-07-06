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
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      allowNegativeStock: false,
      setAllowNegativeStock: (allowNegativeStock) => set({ allowNegativeStock }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
