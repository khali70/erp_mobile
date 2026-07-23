import { useCallback, useRef, useState } from 'react';
import {
  RestoreError,
  applyRestore,
  discardStagedCandidate,
  inspectBackupFile,
  pickBackupFile,
  requestAppExit,
  type RestorePreview,
  type RestoreTarget,
} from '../restore';

/**
 * The restore state machine. All of the file/database work lives in ../restore;
 * this only sequences it and exposes what the dialogs need to render.
 *
 * The backup flow emits TWO files (ledger + attachments), so "restore both" is
 * two picks and two confirmations, run back to back from a small queue. Every
 * step is individually cancellable, and a cancel after a completed step still
 * lands on the success state — the ledger really was replaced, and pretending
 * otherwise would send the owner back into a flow they no longer need.
 */
export type RestoreChoice = RestoreTarget | 'both';

export type RestorePhase =
  | 'idle'
  /** Ledger, attachments, or both. */
  | 'choosing'
  /** System picker is open. A cancel here is silent. */
  | 'picking'
  /** Header/schema/version checks against a staged copy. */
  | 'validating'
  /** Preview + the destructive confirmation. */
  | 'preview'
  /** Blocking, non-dismissible: the live file is being replaced. */
  | 'restoring'
  /** Every requested target handled — restart required. */
  | 'done'
  | 'error';

export function useRestoreDatabase() {
  const [phase, setPhase] = useState<RestorePhase>('idle');
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [error, setError] = useState<RestoreError | null>(null);
  const [restored, setRestored] = useState<RestoreTarget[]>([]);
  /**
   * Latched, never cleared: once ANY target has been replaced, the live handle
   * is closed for the rest of this process and the app is in a state no dialog
   * dismissal can undo. The UI keeps saying so until the owner restarts.
   */
  const [restartRequired, setRestartRequired] = useState(false);

  // Refs, not state: the sequencer reads these inside async continuations, where
  // a re-rendered state value would be a stale snapshot.
  const queue = useRef<RestoreTarget[]>([]);
  const completed = useRef<RestoreTarget[]>([]);

  const reset = useCallback(() => {
    queue.current = [];
    completed.current = [];
    setPreview(null);
    setError(null);
    setRestored([]);
    setPhase('idle');
  }, []);

  /** End the flow: the success state if anything was replaced, else silence. */
  const finish = useCallback(() => {
    queue.current = [];
    setPreview(null);
    if (completed.current.length > 0) setPhase('done');
    else reset();
  }, [reset]);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof RestoreError ? e : new RestoreError('unknown'));
    setPhase('error');
  }, []);

  const runNext = useCallback(async () => {
    const target = queue.current[0];
    if (!target) {
      finish();
      return;
    }
    try {
      setPhase('picking');
      const asset = await pickBackupFile();
      if (!asset) {
        finish(); // cancelled picker — a normal, silent no-op
        return;
      }
      setPhase('validating');
      setPreview(await inspectBackupFile(target, asset));
      setPhase('preview');
    } catch (e) {
      fail(e);
    }
  }, [fail, finish]);

  /** Open the "what do you want to restore?" step. */
  const start = useCallback(() => {
    reset();
    setPhase('choosing');
  }, [reset]);

  const choose = useCallback(
    (choice: RestoreChoice) => {
      queue.current = choice === 'both' ? ['erp', 'attachments'] : [choice];
      void runNext();
    },
    [runNext],
  );

  /** The owner typed the confirmation word and committed. */
  const confirm = useCallback(async () => {
    if (!preview) return;
    setPhase('restoring');
    try {
      const result = await applyRestore(preview);
      setRestartRequired(true);
      completed.current = [...completed.current, ...result.restored];
      setRestored(completed.current);
      queue.current = queue.current.slice(1);
      setPreview(null);
      await runNext();
    } catch (e) {
      fail(e);
    }
  }, [fail, preview, runNext]);

  /** Back out of the preview — the staged copy is deleted, the live DB untouched. */
  const cancel = useCallback(() => {
    if (preview) discardStagedCandidate(preview.target);
    finish();
  }, [finish, preview]);

  /** Dismiss a typed error; drops back to the success state if a step had landed. */
  const dismissError = useCallback(() => finish(), [finish]);

  /**
   * The success CTA. On Android this closes the app — literally what the copy
   * asks for. Everywhere else the app may not terminate itself, so the dialog
   * closes and Settings keeps a standing "restart required" notice in place of
   * the restore row.
   */
  const acknowledge = useCallback(() => {
    if (requestAppExit()) return;
    queue.current = [];
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
     * The ledger was restored without its attachments file — receipt images from
     * the backup will not open until that file is restored too.
     */
    attachmentsMissing: restored.includes('erp') && !restored.includes('attachments'),
    start,
    choose,
    confirm,
    cancel,
    dismissError,
    acknowledge,
    reset,
  };
}
