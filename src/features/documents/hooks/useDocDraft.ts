import { useCallback, useRef } from 'react';
import { storage } from '@/store/mmkv';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { Account } from '@/repositories/transaction-repository';
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
  // Free-text note + receipt attachment metadata. Bytes already live in
  // attachments.db, so persisting the metadata alone re-hydrates the chips.
  note?: string;
  attachments?: AttachmentMeta[];
  quick?: { values: QuickEntryValues; locks: QuickEntryLocks } | null;
  // What the owner said he paid, mirrored so an OS kill mid-entry can't lose it.
  // `paid` is null while UNTOUCHED — meaning "follow the total", which is the
  // default. Only a number the owner actually typed is worth persisting; a
  // stale one would silently override a total that has since changed.
  paid?: string | null;
  account?: Account;
  /** PROOF OF MONEY (the InstaPay screenshot). Bytes already in attachments.db. */
  paymentAttachments?: AttachmentMeta[];
  // SALE ONLY — one sale paid across BOTH pockets. `cashPart` is the cash half
  // as typed; the InstaPay half is always the remainder, so only this is worth
  // persisting (and a restored total that has since changed still adds up).
  split?: boolean;
  cashPart?: string;
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
      if (
        buffer.lines.length === 0 &&
        !buffer.partyName &&
        !buffer.note &&
        !buffer.attachments?.length &&
        !buffer.paymentAttachments?.length &&
        buffer.paid == null &&
        !buffer.split &&
        !buffer.cashPart &&
        !quickHasContent(buffer.quick)
      ) {
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
