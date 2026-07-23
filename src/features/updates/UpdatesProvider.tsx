import { type ReactNode, useEffect, useRef } from 'react';
import { useUpdatesStore } from '@/store/updates-store';
import { useAppUpdates } from './hooks/useAppUpdates';
import { AppUpdatesContext } from './hooks/useAppUpdatesContext';
import { UpdatePromptSheet } from './components/UpdatePromptSheet';

interface UpdatesProviderProps {
  children: ReactNode;
}

/**
 * Mounts the single `useAppUpdates` instance, fires the silent boot check, and
 * renders the "restart to apply" sheet over the whole app.
 *
 * It is rendered only AFTER App.tsx's ready gate, so the auto-check never runs
 * before migrations/seed and never gates the splash. The check is fire-and-
 * forget: it awaits nothing the UI is waiting on, and any failure (offline,
 * runtimeVersion mismatch) is swallowed into the hook's own `error`/`upToDate`
 * state without a red box.
 */
export function UpdatesProvider({ children }: UpdatesProviderProps) {
  const updates = useAppUpdates();
  const autoCheckOnLaunch = useUpdatesStore((s) => s.autoCheckOnLaunch);
  const didAutoCheck = useRef(false);

  const { isEnabled, check } = updates;

  useEffect(() => {
    if (didAutoCheck.current) return;
    if (!isEnabled || !autoCheckOnLaunch) return;
    didAutoCheck.current = true;
    // Fire-and-forget: never awaited by render, never blocks. Offline just fails
    // silently inside the hook and leaves the app fully usable.
    void check();
  }, [isEnabled, autoCheckOnLaunch, check]);

  return (
    <AppUpdatesContext.Provider value={updates}>
      {children}
      <UpdatePromptSheet
        visible={updates.promptVisible}
        onRestart={updates.restart}
        onLater={updates.dismissPrompt}
      />
    </AppUpdatesContext.Provider>
  );
}
