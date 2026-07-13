/**
 * Locale-aware number formatting for the dashboard (Hermes has no ICU).
 * Arabic-Indic digits + '٬' separator for `ar`, Western digits + ',' otherwise.
 */
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function formatDashboardNumber(n: number, lang: string): string {
  const sep = lang === 'ar' ? '٬' : ',';
  const western = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (lang !== 'ar') return western;
  return western.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}
