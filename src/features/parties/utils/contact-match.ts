/**
 * Contact matching — PURE. No React, no expo-contacts, no IO.
 *
 * The whole ranking + normalization brain of the autofill lives here so it can
 * be unit-tested against the spellings a real address book contains, instead of
 * being verified by tapping around a modal.
 */
import { normalizeDigits } from '@/utils/numerals';
import { foldText, foldTokens } from '@/utils/text-fold';
import type { ContactSuggestion } from '../types';

/**
 * Rendered-suggestion cap. An address book with 4,000 entries can match 900 of
 * them on "م"; the owner will never scroll 900 rows, and building them would
 * jank the form he is typing into. Beyond this we say so and ask for more
 * letters.
 */
export const SUGGESTION_LIMIT = 8;

// --- ranking tiers (lower is better) ---------------------------------------
const EXACT = 0;
const NAME_PREFIX = 1;
const TOKEN_PREFIX = 2;
const SUBSTRING = 3;
const TOKENS_UNORDERED = 4;
const TOKENS_LOOSE = 5;

/** Everything that is not a digit, once Arabic-Indic digits are Latinized. */
const NON_DIGIT = /[^0-9]/g;

/**
 * Phone normalization. ONE rule, applied everywhere:
 *
 *   keep a LEADING `+` if the device number has one; drop every other non-digit
 *   (spaces, dashes, parens, dots); Latinize Arabic-Indic digits.
 *
 * We deliberately do NOT rewrite country codes — no adding +20, no turning
 * `002` into `+`, no stripping a leading 0. The owner's phone is the authority
 * on how his customer's number is written, and a "helpful" rewrite that turns a
 * working local number into a non-working international one is a silent data
 * bug he only discovers when a call fails.
 */
export function normalizePhone(raw: string): string {
  const international = raw.trimStart().startsWith('+');
  const digits = normalizeDigits(raw).replace(NON_DIGIT, '');
  if (digits === '') return '';
  return international ? `+${digits}` : digits;
}

/** The shape expo-contacts hands back, narrowed to the two fields we request. */
export interface RawContact {
  id?: string | null;
  name?: string | null;
  phoneNumbers?: ({ number?: string | null } | null)[] | null;
}

/**
 * Device contact → suggestion, or `null` when there is nothing to match on.
 *
 * A contact with a number but NO name is dropped: the list matches on names,
 * and picking a nameless row could only fill a phone the owner is not editing.
 * A contact with a name but no number is KEPT — selecting it fills the name and
 * leaves the phone exactly as the owner left it.
 *
 * Multiple numbers → the FIRST one wins. One row per contact, consistently: a
 * contact yielding three near-identical rows would eat the 8-row cap and make
 * the list unreadable.
 */
export function toSuggestion(raw: RawContact, fallbackId: string): ContactSuggestion | null {
  const name = (raw.name ?? '').trim();
  if (name === '') return null;
  const first = raw.phoneNumbers?.find((p) => p?.number != null && p.number.trim() !== '');
  const phone = first?.number ? normalizePhone(first.number) : '';
  return { id: raw.id ?? fallbackId, name, phone: phone === '' ? null : phone };
}

/** Map a device list to suggestions, dropping the unmatched-on ones. */
export function toSuggestions(raw: readonly RawContact[]): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  raw.forEach((c, i) => {
    const s = toSuggestion(c, `contact-${i}`);
    if (s) out.push(s);
  });
  return out;
}

/**
 * Score a contact name against the typed query. `null` = no match.
 *
 * Tiers, best first: exact → name prefix → any-word prefix → substring →
 * every query word prefixes some name word (out of order) → every query word
 * appears anywhere. "محمد احمد" must find "احمد محمد", but must rank it below a
 * contact literally starting with "محمد احمد".
 */
export function scoreName(query: string, name: string): number | null {
  const q = foldText(query);
  const n = foldText(name);
  if (q === '' || n === '') return null;

  if (n === q) return EXACT;
  if (n.startsWith(q)) return NAME_PREFIX;

  const nameTokens = n.split(' ');
  if (nameTokens.some((tk) => tk.startsWith(q))) return TOKEN_PREFIX;
  if (n.includes(q)) return SUBSTRING;

  const queryTokens = foldTokens(query);
  if (queryTokens.every((qt) => nameTokens.some((tk) => tk.startsWith(qt)))) return TOKENS_UNORDERED;
  if (queryTokens.every((qt) => n.includes(qt))) return TOKENS_LOOSE;

  return null;
}

export interface RankedSuggestions {
  /** Ranked, deduped, capped at `limit`. */
  matches: ContactSuggestion[];
  /** How many matched before the cap. */
  total: number;
  /** `total > limit` — the UI says so instead of pretending these are all. */
  truncated: boolean;
}

/**
 * Rank an address book against a query.
 *
 * Duplicates collapse on (folded name + phone): the same person saved twice —
 * once from SIM, once from WhatsApp — is one row, not two identical ones.
 */
export function rankSuggestions(
  contacts: readonly ContactSuggestion[],
  query: string,
  limit: number = SUGGESTION_LIMIT,
): RankedSuggestions {
  if (foldText(query) === '') return { matches: [], total: 0, truncated: false };

  const scored: { contact: ContactSuggestion; score: number }[] = [];
  const seen = new Set<string>();
  for (const contact of contacts) {
    const score = scoreName(query, contact.name);
    if (score === null) continue;
    const key = `${foldText(contact.name)}|${contact.phone ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({ contact, score });
  }

  // Array#sort is stable, so equal scores keep the device's own order.
  scored.sort((a, b) => a.score - b.score);
  return {
    matches: scored.slice(0, limit).map((s) => s.contact),
    total: scored.length,
    truncated: scored.length > limit,
  };
}
