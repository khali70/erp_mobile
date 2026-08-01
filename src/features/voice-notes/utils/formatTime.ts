import { toLocaleDigits } from '@/utils/numerals';

/**
 * Milliseconds → `m:ss`, localized digits. Used for both the live recording
 * timer and a saved note's length. Clamps negatives to 0 (a status poll can
 * briefly report a tiny negative before the first frame).
 */
export function formatDuration(ms: number, lang: string): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const mm = String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return toLocaleDigits(`${mm}:${ss}`, lang);
}
