import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

// Single app-wide MMKV instance for small persisted UI/settings state. Business
// data lives in SQLite — this is only for flags/preferences that must survive a
// cold start (e.g. allowNegativeStock). Synchronous, so no async hydration gap.
export const storage = createMMKV({ id: 'erp-settings' });

/** zustand `persist` storage adapter backed by MMKV. */
export const mmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};
