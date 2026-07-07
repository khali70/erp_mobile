import { useCallback, useRef } from 'react';
import { storage } from '@/store/mmkv';
import type { DocLine, DocMode, QuickEntryValues, QuickEntryLocks } from '../types';

/**
 * Crash-safe scratch buffer for an in-progress document (the "never lose data"
 * hill). The working lines + party name are mirrored to MMKV (synchronous, so
 * a mistap or an OS kill mid-entry can't drop input) and restored on mount.
 * This is a UI buffer only — nothing here touches the ledger; a document
 * reaches SQLite only when the owner posts it. Cleared once posting succeeds.
 *
 * `quick` carries the fast-entry row (in-progress values + field locks) so an
 * OS kill mid-typing restores the half-entered line AND the locked defaults.
 */
export interface DocDraftBuffer {
  lines: DocLine[];
  partyName: string | null;
  quick?: { values: QuickEntryValues; locks: QuickEntryLocks } | null;
}

/** True when the quick-entry row holds anything worth persisting. */
function quickHasContent(quick: DocDraftBuffer['quick']): boolean {
  if (!quick) return false;
  const v = quick.values;
  return Boolean(
    v.title || v.price || v.note || v.tags.length || Object.values(quick.locks).some(Boolean),
  );
}

const keyFor = (mode: DocMode) => `docdraft:${mode}`;

export function useDocDraft(mode: DocMode) {
  const key = keyFor(mode);

  // Read once, synchronously, for the initial mount hydration.
  const initial = useRef<DocDraftBuffer | null>(null);
  if (initial.current === null) {
    const raw = storage.getString(key);
    if (raw) {
      try {
        initial.current = JSON.parse(raw) as DocDraftBuffer;
      } catch {
        initial.current = { lines: [], partyName: null };
      }
    } else {
      initial.current = { lines: [], partyName: null };
    }
  }

  const persist = useCallback(
    (buffer: DocDraftBuffer) => {
      if (buffer.lines.length === 0 && !buffer.partyName && !quickHasContent(buffer.quick)) {
        storage.remove(key);
        return;
      }
      storage.set(key, JSON.stringify(buffer));
    },
    [key],
  );

  const clear = useCallback(() => storage.remove(key), [key]);

  return { initial: initial.current, persist, clear };
}
