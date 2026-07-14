// Numeral formatting. Hermes ships no ICU, so digit shaping is done manually.
// This is a formatting util (not translatable UI copy) — the Arabic-Indic digit
// glyphs live here by design, keyed by value.

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const ARABIC_THOUSANDS_SEP = '٬';
const ARABIC_DECIMAL_SEP = '٫';
/** U+2212 MINUS SIGN — a real minus, not a hyphen. */
const MINUS = '−';
/** Piastres. EGP/USD are 2-exponent; a 3-exponent currency passes its own. */
const MONEY_FRACTION_DIGITS = 2;
/** Bidi isolates: FIRST STRONG ISOLATE … POP DIRECTIONAL ISOLATE. */
const FSI = '⁨';
const PDI = '⁩';

/** Format an epoch-ms timestamp as `DD/MM/YYYY`, digits shaped for `lang`. */
export function formatDay(ms: number, lang: string): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const western = `${dd}/${mm}/${d.getFullYear()}`;
  if (lang !== 'ar') return western;
  return western.replace(/\d/g, (n) => ARABIC_INDIC[Number(n)]);
}

/** Format a number with Arabic-Indic digits and thousands separators. */
export function toArabicDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(THOUSANDS, ARABIC_THOUSANDS_SEP)
    .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]);
}

/**
 * Locale-aware COUNT: Arabic-Indic for `ar`, Western digits + ',' otherwise.
 *
 * ROUNDS. It is for things you can count — documents, suppliers, days, items —
 * never for money. Money goes through `formatMoneyMajor`, which keeps the
 * piastres: "٠ ج.م" under a row whose whole job is to say the shop now owes
 * money is not a rounding error, it is a lie.
 */
export function formatNumber(value: number, lang: string): string {
  if (lang === 'ar') return toArabicDigits(value);
  return Math.round(value)
    .toString()
    .replace(THOUSANDS, ',');
}

/**
 * MONEY, from MAJOR units — the only formatter money may pass through.
 *
 * Keeps the fraction, always, to the currency's exponent: a 0.50 remainder must
 * read as ٠٫٥٠ and a 1,250.50 invoice as ١٬٢٥٠٫٥٠. It never rounds to whole
 * pounds, and it shapes digits + separators for `ar` (Arabic-Indic, ٬ / ٫).
 *
 * A negative value keeps its MINUS. Callers that mean a magnitude (a credit
 * rendered under its own title) pass an absolute value; nothing else may drop
 * the sign, because colour alone cannot carry it.
 */
export function formatMoneyMajor(
  value: number,
  lang: string,
  fractionDigits: number = MONEY_FRACTION_DIGITS,
): string {
  const fixed = Math.abs(value).toFixed(fractionDigits);
  // −0.004 rounds to zero: show "٠٫٠٠", never "−٠٫٠٠".
  const negative = value < 0 && Number(fixed) !== 0;
  const [whole, fraction] = fixed.split('.');
  const arabic = lang === 'ar';
  const grouped = whole.replace(THOUSANDS, arabic ? ARABIC_THOUSANDS_SEP : ',');
  const joined = fraction
    ? `${grouped}${arabic ? ARABIC_DECIMAL_SEP : '.'}${fraction}`
    : grouped;
  const shaped = arabic ? joined.replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]) : joined;
  return negative ? `${MINUS}${shaped}` : shaped;
}

/**
 * Shape a CANONICAL numeric string ("25.20") for display in `lang`.
 *
 * For a text INPUT: the value is stored canonically (Latin digits, '.') and only
 * shaped on the way to the screen, so an Arabic owner sees ٢٥٫٢٠ in the box
 * while `parseFloat` still sees something it can read. `normalizeDigits` is the
 * exact inverse, applied on the way back in.
 */
export function toLocaleDigits(value: string, lang: string): string {
  if (lang !== 'ar') return value;
  return value
    .replace(/\./g, ARABIC_DECIMAL_SEP)
    .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]);
}

/** Any locale's digits/decimal mark → canonical Latin, ready for `parseFloat`. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫،]/g, '.');
}

/**
 * Fence a run of text off from the bidi algorithm.
 *
 * A leading "+"/"−" in front of Arabic-Indic digits (bidi class AN) inside an
 * RTL paragraph is a classic reordering trap: the sign is a NEUTRAL, so it
 * resolves against whatever happens to sit next to it and can jump to the far
 * end of the line — turning "− ٥٠٠ ج.م" into a positive-looking figure the
 * moment the string is concatenated with a label. Isolating the run makes the
 * surrounding text unable to reorder it, whatever it is.
 */
export function bidiIsolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}
