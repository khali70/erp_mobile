import { useCallback, useState } from 'react';
import {
  RestoreError,
  applyRestore,
  discardStagedCandidate,
  inspectBackupFile,
  pickBackupFile,
  requestAppRestart,
  type BackupFormat,
  type RestorePreview,
  type RestoreTarget,
} from '../restore';

/**
 * The restore state machine. All of the file/database work lives in ../restore;
 * this only sequences it and exposes what the dialogs need to render.
 *
 * ONE pick, ONE confirmation, one safety-snapshot cycle — including for a full
 * backup, which carries both databases in a single artifact. (An earlier version
 * queued two picks because backup emitted two files; the queue is gone with the
 * format that required it, and the older single-database files are still
 * restorable, one at a time.)
 */
export type RestoreChoice = BackupFormat;

export type RestorePhase =
  | 'idle'
  /** Full backup (zip), the older merged `.db`, or a single-database file. */
  | 'choosing'
  /** System picker is open. A cancel here is silent. */
  | 'picking'
  /** Header/marker/schema/version checks against a staged copy. */
  | 'validating'
  /** Preview + the destructive confirmation. */
  | 'preview'
  /** Blocking, non-dismissible: the live file(s) are being replaced. */
  | 'restoring'
  /** Done — restart required. */
  | 'done'
  | 'error';

export function useRestoreDatabase() {
  const [phase, setPhase] = useState<RestorePhase>('idle');
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [error, setError] = useState<RestoreError | null>(null);
  const [restored, setRestored] = useState<RestoreTarget[]>([]);
  /** Voice recordings that could not be written back — a non-blocking warning. */
  const [voiceFailed, setVoiceFailed] = useState(0);
  /**
   * Latched, never cleared: once anything has been replaced, the live handles
   * are closed for the rest of this process and the app is in a state no dialog
   * dismissal can undo. The UI keeps saying so until the owner restarts.
   */
  const [restartRequired, setRestartRequired] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setPhase('idle');
  }, []);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof RestoreError ? e : new RestoreError('unknown'));
    setPhase('error');
  }, []);

  /** Open the "what are you restoring?" step. */
  const start = useCallback(() => {
    setRestored([]);
    setVoiceFailed(0);
    reset();
    setPhase('choosing');
  }, [reset]);

  const choose = useCallback(
    async (choice: RestoreChoice) => {
      try {
        setPhase('picking');
        const asset = await pickBackupFile();
        if (!asset) {
          reset(); // cancelled picker — a normal, silent no-op
          return;
        }
        setPhase('validating');
        setPreview(await inspectBackupFile(choice, asset));
        setPhase('preview');
      } catch (e) {
        fail(e);
      }
    },
    [fail, reset],
  );

  /** The owner typed the confirmation word and committed. */
  const confirm = useCallback(async () => {
    if (!preview) return;
    setPhase('restoring');
    try {
      const result = await applyRestore(preview);
      setRestartRequired(true);
      setRestored(result.restored);
      setVoiceFailed(result.voiceFailed);
      setPreview(null);
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  }, [fail, preview]);

  /** Back out of the preview — the staged copy is deleted, the live DBs untouched. */
  const cancel = useCallback(() => {
    if (preview) discardStagedCandidate();
    reset();
  }, [preview, reset]);

  /** Dismiss a typed error. */
  const dismissError = useCallback(() => {
    if (restartRequired) setPhase('done');
    else reset();
  }, [reset, restartRequired]);

  /**
   * The success CTA — restart, by whatever means this build actually has. When
   * none of them work (iOS without expo-updates enabled) the dialog closes and
   * Settings keeps a standing "restart required" notice in place of the restore
   * row, because the process really is running on closed handles.
   */
  const acknowledge = useCallback(async () => {
    if (await requestAppRestart()) return;
    setPreview(null);
    setError(null);
    setPhase('idle');
  }, []);

  return {
    phase,
    preview,
    error,
    restored,
    restartRequired,
    /**
     * A ledger-only file was restored, so the receipt bytes on the phone still
     * belong to whatever was there before — images referenced by the restored
     * documents may not open. Never true for a full backup carrying both halves.
     */
    attachmentsMissing: restored.includes('erp') && !restored.includes('attachments'),
    /**
     * Some voice recordings could not be written back after the ledger was
     * restored. Non-blocking: the books and receipts are already in place. The
     * success dialog surfaces a "some recordings may be missing" note.
     */
    voiceRecordingsMissing: voiceFailed > 0,
    start,
    choose,
    confirm,
    cancel,
    dismissError,
    acknowledge,
    reset,
  };
}
