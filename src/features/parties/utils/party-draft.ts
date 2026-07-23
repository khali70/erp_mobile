/**
 * The party draft transitions — PURE, and deliberately written without spread.
 *
 * THE RULE THIS FILE EXISTS FOR: editing the PHONE may never touch the NAME.
 *
 * The failure it prevents is not hypothetical. The obvious way to build a
 * contact-aware form is "on every change, look the value up and fill the rest",
 * and the moment that runs on the phone field, an owner who typed "محل الحاج
 * سيد" and then typed a number watches his own name get replaced by whatever
 * the address book calls that number. He does not notice — the field is above
 * the one he is looking at — and the wrong name is what gets saved.
 *
 * Convention ("just don't do it in the handler") is not enough, because the
 * next handler is written by someone who did not read this comment. So the rule
 * is STRUCTURAL: `withPhone` takes a `string`, not a contact, and rebuilds the
 * draft field by field. Its only possible source for `name` is `draft.name`.
 * There is no expression inside it that could produce a different name. Nothing
 * short of editing this function can break the guarantee, and editing it means
 * deleting the test that guards it.
 */
import type { ContactSuggestion, PartyDraft } from '../types';

export const EMPTY_DRAFT: PartyDraft = { name: '', phone: '' };

/**
 * Phone edit. Carries `name` across UNCHANGED, by construction.
 * No spread: a spread of a wider object could smuggle a `name` in.
 */
export function withPhone(draft: PartyDraft, phone: string): PartyDraft {
  return { name: draft.name, phone };
}

/** Name edit. The mirror image — the phone is carried across untouched. */
export function withName(draft: PartyDraft, name: string): PartyDraft {
  return { name, phone: draft.phone };
}

/**
 * Picking a contact suggestion — the ONE transition allowed to set both fields,
 * because the owner explicitly tapped a row that showed him both.
 *
 * A contact with no number fills the name only and leaves the phone as it was:
 * blanking a number the owner already typed, because the address-book entry
 * happens to lack one, would be a deletion he never asked for.
 */
export function withContact(draft: PartyDraft, contact: ContactSuggestion): PartyDraft {
  return { name: contact.name, phone: contact.phone ?? draft.phone };
}
