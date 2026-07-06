// Numeral formatting. Hermes ships no ICU, so digit shaping is done manually.
// This is a formatting util (not translatable UI copy) — the Arabic-Indic digit
// glyphs live here by design, keyed by value.

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;
const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const ARABIC_THOUSANDS_SEP = '٬';

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

/** Locale-aware: Arabic-Indic for `ar`, Western digits + ',' otherwise. */
export function formatNumber(value: number, lang: string): string {
  if (lang === 'ar') return toArabicDigits(value);
  return Math.round(value)
    .toString()
    .replace(THOUSANDS, ',');
}
