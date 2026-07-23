// Party domain view-types (customers & suppliers share this shape).

/**
 * A party as the UI consumes it. `balanceMinor` is INTEGER minor units:
 *   customers: + = the customer owes the shop (receivable / ديون لك)
 *   suppliers: + = the shop owes the supplier (payable / ديون عليك)
 */
export interface Party {
  id: string;
  name: string;
  phone: string | null;
  balanceMinor: number;
}

/** Editable fields captured by the party form. */
export interface PartyDraft {
  name: string;
  phone: string;
}

/**
 * One device contact, normalized for the name-field autofill.
 *
 * MEMORY ONLY. This never reaches SQLite: there is no contact column, no
 * contact table, and the device contact `id` is deliberately not persisted —
 * the app copies a name and a number, it does not link to the address book.
 */
export interface ContactSuggestion {
  /** Device contact id. Used as a list key only, never stored. */
  id: string;
  /** Display name, in the owner's own spelling — written to the draft as-is. */
  name: string;
  /** PRIMARY (first) device number, digit-normalized. null = contact has none. */
  phone: string | null;
}

/**
 * Contact-access state machine. `idle` until the owner engages the name field —
 * the permission prompt must never fire at mount or at app launch.
 *
 * Every non-`ready` state leaves the form fully usable as manual entry; none of
 * them may block typing or saving.
 */
export type ContactsAccess =
  /** Never asked. Nothing rendered. */
  | 'idle'
  /** Prompting, or reading a large address book. */
  | 'loading'
  /** Granted and loaded. */
  | 'ready'
  /** Refused, but the OS will let us ask again. */
  | 'denied'
  /** Refused for good (canAskAgain === false) — Settings is the only route. */
  | 'blocked'
  /** The contacts API threw. Swallowed into a quiet note; never a red box. */
  | 'unavailable';
