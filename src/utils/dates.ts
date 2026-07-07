// Date formatting via Intl.DateTimeFormat. Hermes (RN 0.86 / Expo 57) ships
// Intl with ICU on both platforms, so locale digit shaping + ordering come for
// free — `ar-EG` yields Arabic-Indic digits, `en-GB` yields DD/MM/YYYY. A manual
// fallback covers any runtime where Intl.DateTimeFormat is unavailable so a date
// never renders as a broken number (e.g. a thousands-separated year like 2,026).

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Map an app language to a BCP-47 locale for Intl. */
function localeFor(lang: string): string {
  return lang === 'ar' ? 'ar-EG' : 'en-GB';
}

/** Manual DD/MM/YYYY shaping — fallback when Intl.DateTimeFormat is missing. */
function fallbackDay(d: Date, lang: string): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const western = `${dd}/${mm}/${d.getFullYear()}`;
  if (lang !== 'ar') return western;
  return western.replace(/\d/g, (n) => ARABIC_INDIC[Number(n)]);
}

const hasIntl = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

/**
 * Format an epoch-ms timestamp as a locale-aware date. `style` maps to
 * Intl `dateStyle`; defaults to `short` (numeric DD/MM/YYYY). Digits and
 * ordering follow the locale — never pass date parts through `formatNumber`,
 * which groups the year (2026 → "2,026").
 */
export function formatDate(
  ms: number,
  lang: string,
  style: 'short' | 'medium' | 'long' = 'short',
): string {
  const d = new Date(ms);
  if (!hasIntl) return fallbackDay(d, lang);
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: style }).format(d);
  } catch {
    return fallbackDay(d, lang);
  }
}
