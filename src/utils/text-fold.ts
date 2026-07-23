/**
 * Text folding for SEARCH ONLY — never for storage, never for display.
 *
 * Arabic is written many ways for the same name. A shop owner who saved
 * "أحمد" in his phone will type "احمد" into the form, and a plain
 * `String.includes` finds nothing: أ (U+0623) and ا (U+0627) are different
 * codepoints. Same trap for ة/ه at the end of "فاطمة", ى/ي at the end of
 * "مصطفى", and any name saved WITH tashkeel ("مُحَمَّد") — invisible marks that
 * break every comparison.
 *
 * So folding is not politeness, it is the difference between the contact
 * autofill working and the owner concluding it is broken. What we fold:
 *   • alef family  أ إ آ ٱ ٲ ٳ → ا
 *   • hamza seats  ؤ → و, ئ → ي, ء dropped
 *   • taa marbuta  ة → ه          (spelling of the same sound)
 *   • alef maqsura ى → ي
 *   • tashkeel (U+064B..U+0652, U+0670) and tatweel (ـ) removed
 *   • case-folded, whitespace collapsed
 *
 * The folded string is a MATCH KEY. It is deliberately lossy — writing it back
 * to the database would silently rewrite the owner's spelling of a name.
 */

/** Combining marks: fathatan…sukun, superscript alef, and the hamza seats. */
const TASHKEEL = /[ً-ٰٕ]/g;
/** ـ U+0640 ARABIC TATWEEL — pure decoration, carries no sound. */
const TATWEEL = /ـ/g;
/** Every character that folds onto another, keyed by what it folds TO. */
const FOLD_MAP: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا',
  'ؤ': 'و',
  'ئ': 'ي', 'ى': 'ي',
  'ة': 'ه',
  'ء': '',
};
const FOLDABLE = /[أإآٱٲٳؤئىةء]/g;
const WHITESPACE = /\s+/g;

/**
 * Fold text to a comparison key: lower-cased, unmarked, whitespace-collapsed.
 *
 * Latin passes through as a plain lowercase trim, so a mixed address book
 * ("Ahmed", "أحمد") folds through one code path.
 */
export function foldText(value: string): string {
  return value
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(FOLDABLE, (c) => FOLD_MAP[c])
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim();
}

/** Folded whitespace-separated tokens; `[]` for blank input. */
export function foldTokens(value: string): string[] {
  const folded = foldText(value);
  return folded === '' ? [] : folded.split(' ');
}
