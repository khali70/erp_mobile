import { useCallback, useRef } from 'react';
import { storage } from '@/store/mmkv';
import type { DocLine, DocMode } from '../types';

/**
 * Crash-safe scratch buffer for an in-progress document (the "never lose data"
 * hill). The working lines + party name are mirrored to MMKV (synchronous, so
 * a mistap or an OS kill mid-entry can't drop input) and restored on mount.
 * This is a UI buffer only — nothing here touches the ledger; a document
 * reaches SQLite only when the owner posts it. Cleared once posting succeeds.
 */
export interface DocDraftBuffer {
  lines: DocLine[];
  partyName: string | null;
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
      if (buffer.lines.length === 0 && !buffer.partyName) {
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
