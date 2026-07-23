import { createContext, useContext } from 'react';
import type { AppUpdates } from '../types';

/**
 * The one shared `useAppUpdates` instance, provided at the app root. Sharing one
 * instance is what lets the boot-time auto-check and the Settings status row see
 * the SAME state: an update found on launch already lights the row, and no second
 * check is fired behind it.
 */
export const AppUpdatesContext = createContext<AppUpdates | null>(null);

export function useAppUpdatesContext(): AppUpdates {
  const ctx = useContext(AppUpdatesContext);
  if (!ctx) throw new Error('useAppUpdatesContext must be used within <UpdatesProvider>');
  return ctx;
}
