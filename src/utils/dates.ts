// Date formatting via Intl.DateTimeFormat. Hermes (RN 0.86 / Expo 57) ships
// Intl with ICU on both platforms, so locale digit shaping + ordering come for
// free — `ar-EG` yields Arabic-Indic digits, `en-GB` yields DD/MM/YYYY. A manual
// fallback covers any runtime where Intl.DateTimeFormat is unavailable so a date
// never renders as a broken number (e.g. a thousands-separated year like 2,026).

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

const DAY_MS = 86_400_000;

/** Shift an epoch-ms timestamp by whole days (negative = back in time). */
export function addDays(ms: number, days: number): number {
  return ms + days * DAY_MS;
}

/** True when two epoch-ms timestamps fall on the same calendar day, locally. */
export function isSameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Epoch ms of the first instant of `ms`'s day, in the shop's LOCAL timezone.
 *
 * LOCAL, never UTC. The shop is in Egypt (UTC+2/+3): a 22:30 sale bucketed by
 * UTC lands in the wrong day, and the owner counting his drawer at closing would
 * find the app disagreeing with the money in his hand.
 */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Epoch ms of the first instant of the day AFTER `ms`'s — an exclusive bound. */
export function endOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/** Whole days between two epoch-ms timestamps. Floors; never negative. */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

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

/**
 * The month's NAME, localised ("يوليو" / "July").
 *
 * Via Intl, never a hardcoded string: the expenses screen used to render the
 * literal Arabic "يوليو" as an i18n defaultValue, which was both untranslatable
 * and wrong for eleven months of the year. The numeric month is the fallback.
 */
export function formatMonth(ms: number, lang: string): string {
  const d = new Date(ms);
  if (!hasIntl) return String(d.getMonth() + 1);
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { month: 'long' }).format(d);
  } catch {
    return String(d.getMonth() + 1);
  }
}

/** Epoch ms of the first instant of `ms`'s month, in the shop's LOCAL timezone. */
export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Epoch ms of the first instant of the month `delta` months from `ms`'s. */
export function shiftMonth(ms: number, delta: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
}
