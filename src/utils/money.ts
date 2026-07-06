// Money is stored as INTEGER minor units (piastres/cents). Never float.
// All arithmetic is integer math on minor units; format for display only.
// Canonical rules: data-model.md §6.

export type Minor = number; // integer minor units

// Minor-unit exponent per currency (EGP/USD = 2). Do not hardcode /100 at call
// sites — go through currencyExponent so multi-currency needs no rewrite.
const EXPONENT: Record<string, number> = {
  EGP: 2,
  USD: 2,
  EUR: 2,
  SAR: 2,
  KWD: 3,
  JPY: 0,
};
const DEFAULT_EXPONENT = 2;

export function currencyExponent(currency = 'EGP'): number {
  return EXPONENT[currency] ?? DEFAULT_EXPONENT;
}

function factor(currency: string): number {
  return 10 ** currencyExponent(currency);
}

/** Parse a user-entered major-unit value (e.g. "12.50") to integer minor units.
 *  Round-half-up at the input boundary — the single rounding point. */
export function toMinor(major: string | number, currency = 'EGP'): Minor {
  const n = typeof major === 'number' ? major : parseFloat(major);
  if (!isFinite(n)) return 0;
  return Math.round(n * factor(currency));
}

/** Integer minor units → major-unit number (e.g. 1250 -> 12.5). */
export function fromMinor(minor: Minor, currency = 'EGP'): number {
  return minor / factor(currency);
}

/** Integer minor units → fixed-decimal string (e.g. 1250 -> "12.50"). */
export function toMajor(minor: Minor, currency = 'EGP'): string {
  return fromMinor(minor, currency).toFixed(currencyExponent(currency));
}

/** Multiply a (possibly fractional) qty by a unit price in minor units.
 *  The one place a fractional→integer rounding happens. Round half-up. */
export function lineTotal(qty: number, unitPrice: Minor): Minor {
  return Math.round(qty * unitPrice);
}

/** Format for display with a currency code. Storage never uses this. */
export function formatMoney(minor: Minor, currency = 'EGP'): string {
  return `${toMajor(minor, currency)} ${currency}`;
}
