/** i18n key + count for a "time ago" phrase — mapped to copy by the component. */
export interface RelativeTime {
  key:
    | 'updates.relative.justNow'
    | 'updates.relative.minutesAgo'
    | 'updates.relative.hoursAgo'
    | 'updates.relative.daysAgo';
  count: number;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Bucket the gap between `fromMs` and `nowMs` into just-now / minutes / hours /
 * days. Pure — takes `nowMs` explicitly so it is deterministic under a frozen
 * test clock and never reads the wall clock itself. A future timestamp (clock
 * skew) clamps to "just now" rather than reporting a negative age.
 */
export function relativeTime(fromMs: number, nowMs: number): RelativeTime {
  const diff = Math.max(0, nowMs - fromMs);
  if (diff < MINUTE) return { key: 'updates.relative.justNow', count: 0 };
  if (diff < HOUR) return { key: 'updates.relative.minutesAgo', count: Math.floor(diff / MINUTE) };
  if (diff < DAY) return { key: 'updates.relative.hoursAgo', count: Math.floor(diff / HOUR) };
  return { key: 'updates.relative.daysAgo', count: Math.floor(diff / DAY) };
}
