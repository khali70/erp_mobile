/**
 * The party form's draft state — the state layer where name/phone independence
 * is ENFORCED (see src/features/parties/utils/party-draft.ts for why it is
 * structural rather than a convention in a handler).
 *
 * Local state, not zustand: the draft is transient, dies with the modal, and
 * durable data lives in SQLite.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_DRAFT, withContact, withName, withPhone } from '../utils/party-draft';
import type { ContactSuggestion, PartyDraft } from '../types';

export interface UsePartyDraft {
  draft: PartyDraft;
  setName: (name: string) => void;
  /** Phone-only. Cannot reach `name` — that is the point. */
  setPhone: (phone: string) => void;
  pickContact: (contact: ContactSuggestion) => void;
  canSave: boolean;
}

/**
 * @param visible modal visibility — the draft resets to `initial` on each open,
 *   so yesterday's half-typed customer never leaks into today's supplier.
 * @param initial the stored party when editing, `null` when adding. Edit mode
 *   pre-fills and is never auto-overwritten: nothing but an explicit tap on a
 *   suggestion row may replace a saved name or number.
 */
export function usePartyDraft(visible: boolean, initial: PartyDraft | null): UsePartyDraft {
  const [draft, setDraft] = useState<PartyDraft>(initial ?? EMPTY_DRAFT);
  const wasVisible = useRef(false);
  // The latest `initial` without making it an effect dependency — see below.
  const latestInitial = useRef(initial);
  latestInitial.current = initial;

  // Reset on the OPEN EDGE only, never on every render while open.
  //
  // The callers pass `initial` as an inline object literal, so its identity
  // changes on every parent render. Keying the reset off the VALUE would mean
  // any unrelated re-render of the list screen (a reload, a filter chip) silently
  // throws away whatever the owner has typed into the open form.
  useEffect(() => {
    if (visible && !wasVisible.current) setDraft(latestInitial.current ?? EMPTY_DRAFT);
    wasVisible.current = visible;
  }, [visible]);

  const setName = useCallback((name: string) => setDraft((prev) => withName(prev, name)), []);
  const setPhone = useCallback((phone: string) => setDraft((prev) => withPhone(prev, phone)), []);
  const pickContact = useCallback(
    (contact: ContactSuggestion) => setDraft((prev) => withContact(prev, contact)),
    [],
  );

  return { draft, setName, setPhone, pickContact, canSave: draft.name.trim() !== '' };
}
