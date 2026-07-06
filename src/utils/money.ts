// Money is stored as INTEGER minor units (piastres/cents). Never float.
// Default currency EGP (2 minor digits).

export type Minor = number; // integer minor units

const MINOR_PER_MAJOR = 100;

/** Parse a user-entered major-unit string (e.g. "12.50") to integer minor units. */
export function toMinor(major: string | number): Minor {
  const n = typeof major === 'number' ? major : parseFloat(major);
  if (!isFinite(n)) return 0;
  return Math.round(n * MINOR_PER_MAJOR);
}

/** Format integer minor units to a major-unit string (e.g. 1250 -> "12.50"). */
export function toMajor(minor: Minor): string {
  return (minor / MINOR_PER_MAJOR).toFixed(2);
}

/** Format for display with a currency code. */
export function formatMoney(minor: Minor, currency = 'EGP'): string {
  return `${toMajor(minor)} ${currency}`;
}
