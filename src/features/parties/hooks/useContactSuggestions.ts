/**
 * Device-contact suggestions for the party name field.
 *
 * OWNS: permission state, the one-per-session read of the address book, the
 * debounce, and the ranking call. The components below it are presentational —
 * values and callbacks in, no side effects.
 *
 * READ-ONLY, and offline by construction. It requests exactly two fields
 * (full name + phones), never calls a create/update/delete API, never writes a
 * contact row to SQLite, and makes no network call of any kind. The address
 * book lives in this module's memory for the lifetime of the process and is
 * gone on the next launch.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUGGESTION_LIMIT, rankSuggestions, toSuggestions } from '../utils/contact-match';
import type { ContactSuggestion, ContactsAccess } from '../types';

/**
 * Typing settles before we rank. Long enough that a name typed at speed ranks
 * once instead of six times, short enough that the list feels attached to the
 * keyboard.
 */
const DEBOUNCE_MS = 180;

interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

interface ContactsApi {
  getPermissionsAsync(): Promise<PermissionResult>;
  requestPermissionsAsync(): Promise<PermissionResult>;
  /** Name + phones only. */
  readNames(): Promise<ContactSuggestion[]>;
}

/** `undefined` = not resolved yet; `null` = the native module is not there. */
let api: ContactsApi | null | undefined;

/**
 * LAZY, guarded load of expo-contacts.
 *
 * A top-level `import` of a native module resolves at module-eval time, and
 * `requireNativeModule` THROWS when the binary predates the module — an owner
 * running yesterday's build would open the customers screen and watch it crash,
 * over a convenience feature he never asked for. The whole point of this hook
 * is that the form works without contacts, so a missing module has to look
 * exactly like a refused permission: a quiet note, and a form that still saves.
 */
function getApi(): ContactsApi | null {
  if (api !== undefined) return api;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-contacts') as typeof import('expo-contacts');
    // The two fields the feature needs. Nothing else is requested — not emails,
    // not addresses, not photos: a permission's blast radius is the fields it
    // reads, and this one reads a name and a number.
    const fields = [mod.ContactField.FULL_NAME, mod.ContactField.PHONES] as const;
    api = {
      getPermissionsAsync: () => mod.getPermissionsAsync(),
      requestPermissionsAsync: () => mod.requestPermissionsAsync(),
      readNames: async () => {
        const details = await mod.Contact.getAllDetails(fields);
        return toSuggestions(
          details.map((d) => ({ id: d.id, name: d.fullName, phoneNumbers: d.phones })),
        );
      },
    };
  } catch {
    api = null;
  }
  return api;
}

/**
 * Process-lifetime cache. Reading thousands of contacts is the slow part; doing
 * it once per app run (rather than once per modal open) is what keeps the form
 * instant on the second customer. MEMORY ONLY — nothing here is persisted.
 */
let sessionContacts: ContactSuggestion[] | null = null;

/** Test/dev seam: drop the cached address book. */
export function clearContactSession(): void {
  sessionContacts = null;
}

export interface UseContactSuggestions {
  access: ContactsAccess;
  /** Ranked and capped. Empty until the owner types something. */
  suggestions: ContactSuggestion[];
  /** More matched than we render — the UI says so. */
  truncated: boolean;
  /** How many rows we cap at, for the truncation copy. */
  limit: number;
  /** True while the list should be on screen. */
  open: boolean;
  /** First engagement with the name field (focus, or the import button). */
  engage: () => void;
  /** Explicit retry from the permission note's button — bypasses the once-guard. */
  retry: () => void;
  /** Feed the name field's text. Never echoes back into the field. */
  search: (query: string) => void;
  /** Owner dismissed the list; it reopens on the next keystroke. */
  dismiss: () => void;
}

/**
 * @param enabled the form's visibility. False tears the query down so a
 *   half-typed search cannot survive into the next time the sheet opens.
 */
export function useContactSuggestions(enabled: boolean): UseContactSuggestions {
  const [access, setAccess] = useState<ContactsAccess>('idle');
  const [contacts, setContacts] = useState<ContactSuggestion[]>(sessionContacts ?? []);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const alive = useRef(true);
  const inFlight = useRef(false);
  /** Blocks the prompt from re-firing on every focus after a refusal. */
  const asked = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (contactsApi: ContactsApi) => {
    if (sessionContacts) {
      setContacts(sessionContacts);
      setAccess('ready');
      return;
    }
    const mapped = await contactsApi.readNames();
    sessionContacts = mapped;
    if (!alive.current) return;
    setContacts(mapped);
    setAccess('ready');
  }, []);

  const run = useCallback(
    async (force: boolean) => {
      if (inFlight.current) return;
      if (!force && asked.current) return;
      const contactsApi = getApi();
      if (!contactsApi) {
        asked.current = true;
        setAccess('unavailable');
        return;
      }
      asked.current = true;
      inFlight.current = true;
      setAccess('loading');
      try {
        const current = await contactsApi.getPermissionsAsync();
        const decided = current.granted ? current : await contactsApi.requestPermissionsAsync();
        if (!alive.current) return;
        if (decided.granted) {
          await load(contactsApi);
          return;
        }
        setAccess(decided.canAskAgain ? 'denied' : 'blocked');
      } catch {
        // The contacts API is a nice-to-have on top of a form that works
        // without it. Whatever it threw — missing native module in Expo Go, an
        // OS-level failure reading the store — the owner still has a name box
        // and a phone box, so this becomes a quiet inline note and nothing else.
        if (!alive.current) return;
        asked.current = false; // an error may be transient; allow a retry
        setAccess('unavailable');
      } finally {
        inFlight.current = false;
      }
    },
    [load],
  );

  const engage = useCallback(() => {
    if (access === 'ready' || access === 'loading' || access === 'blocked') return;
    void run(false);
  }, [access, run]);

  const retry = useCallback(() => {
    void run(true);
  }, [run]);

  const search = useCallback((next: string) => {
    setQuery(next);
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  // Close-down: the query dies with the sheet, the permission decision does not.
  useEffect(() => {
    if (enabled) return;
    setQuery('');
    setDebounced('');
    setDismissed(false);
  }, [enabled]);

  // Debounce. A 4,000-row address book must not be ranked on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const ranked = useMemo(
    () => rankSuggestions(contacts, debounced, SUGGESTION_LIMIT),
    [contacts, debounced],
  );

  // The list is on screen only when the owner is actively typing a name and has
  // not waved it away. In edit mode nothing shows until he touches the field,
  // so a stored name is never shadowed by a dropdown he did not ask for.
  const open = enabled && !dismissed && query.trim() !== '' && access !== 'idle';

  return {
    access,
    suggestions: ranked.matches,
    truncated: ranked.truncated,
    limit: SUGGESTION_LIMIT,
    open,
    engage,
    retry,
    search,
    dismiss,
  };
}
