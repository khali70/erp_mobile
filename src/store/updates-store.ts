import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './mmkv';

/**
 * OTA update PREFERENCES + cached display metadata — a sibling of settings-store,
 * NOT a slice of it.
 *
 * Rationale: settings-store holds money/data-integrity flags (allowNegativeStock)
 * and privacy flags — device invariants the business logic reads. What lives here
 * is an unrelated concern: one user preference (auto-check on launch) plus a cache
 * of the last check's metadata for the Settings row to render offline. The source
 * of truth is always the expo-updates API; this only caches what to SHOW. Keeping
 * it in its own store (own persist key) stops the OTA cache from bloating the
 * integrity store and keeps the feature self-contained (feature-first).
 */
type UpdatesState = {
  /** Silently check for an update shortly after each cold start. Default: on. */
  autoCheckOnLaunch: boolean;
  setAutoCheckOnLaunch: (v: boolean) => void;

  /** Epoch ms of the last completed check. Cached so the row reads correct offline. */
  lastCheckedAt: number | null;
  setLastCheckedAt: (v: number) => void;

  /** Cached copy of `Updates.updateId` / `Updates.channel` for display when offline. */
  currentUpdateId: string | null;
  currentChannel: string | null;
  setCurrentMeta: (updateId: string | null, channel: string | null) => void;
};

export const useUpdatesStore = create<UpdatesState>()(
  persist(
    (set) => ({
      autoCheckOnLaunch: true,
      setAutoCheckOnLaunch: (autoCheckOnLaunch) => set({ autoCheckOnLaunch }),
      lastCheckedAt: null,
      setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt }),
      currentUpdateId: null,
      currentChannel: null,
      setCurrentMeta: (currentUpdateId, currentChannel) => set({ currentUpdateId, currentChannel }),
    }),
    {
      name: 'updates',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
