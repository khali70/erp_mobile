import { useCallback, useState } from 'react';
import {
  detectInterruptedRestore,
  discardInterruptedRestore,
  isRollbackAvailable,
  rollbackInterruptedRestore,
  type RestoreMarker,
} from '../restore';

type RecoveryPhase = 'prompt' | 'working' | 'rolled-back' | 'failed';

/**
 * Boot-time recovery for a restore that never finished.
 *
 * The marker is read ONCE, lazily, at first render — before any migration runs
 * or any screen reads a row. A marker means the process died between closing the
 * live handle and finishing the copy, so the file at the live path may be half
 * written; the app must offer the pre-restore snapshot back instead of booting
 * onto it.
 */
export function useInterruptedRestore() {
  const [marker, setMarker] = useState<RestoreMarker | null>(() => detectInterruptedRestore());
  const [phase, setPhase] = useState<RecoveryPhase>('prompt');

  const rollback = useCallback(async () => {
    if (!marker) return;
    setPhase('working');
    try {
      await rollbackInterruptedRestore(marker);
      // The live handle is closed now — a restart is required, exactly as after
      // a successful restore. The screen stays up and says so.
      setPhase('rolled-back');
    } catch {
      setPhase('failed');
    }
  }, [marker]);

  /** Keep whatever is on disk and boot normally. The owner's call. */
  const keepCurrent = useCallback(() => {
    discardInterruptedRestore();
    setMarker(null);
  }, []);

  return {
    marker,
    phase,
    /** Cache can be evicted; without the snapshot there is nothing to roll back to. */
    canRollback: marker ? isRollbackAvailable(marker) : false,
    rollback,
    keepCurrent,
  };
}
