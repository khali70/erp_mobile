// Numeral formatting. Hermes ships no ICU, so digit shaping is done manually.
// This is a formatting util (not translatable UI copy) — the Arabic-Indic digit
// glyphs live here by design, keyed by value.

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const ARABIC_THOUSANDS_SEP = '٬';

/** Format a number with Arabic-Indic digits and thousands separators. */
export function toArabicDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(THOUSANDS, ARABIC_THOUSANDS_SEP)
    .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]);
}
