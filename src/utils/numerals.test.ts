import {
  bidiIsolate,
  formatMoneyMajor,
  formatNumber,
  normalizeDigits,
  toLocaleDigits,
} from './numerals';
import { fromMinor } from './money';

describe('formatNumber — COUNTS', () => {
  // It rounds, and that is correct: you cannot have 2.4 suppliers. It is money
  // that must never come through here.
  it('rounds and groups, in both numeral systems', () => {
    expect(formatNumber(1250, 'en')).toBe('1,250');
    expect(formatNumber(1250.5, 'en')).toBe('1,251');
    expect(formatNumber(1250, 'ar')).toBe('١٬٢٥٠');
  });
});

describe('formatMoneyMajor — MONEY', () => {
  it('KEEPS the piastres — money is never rounded to whole pounds', () => {
    // The bug: a remaining debt of 0.50 rendered as "٠" under a row whose whole
    // job is to say the shop now owes money.
    expect(formatMoneyMajor(0.5, 'ar')).toBe('٠٫٥٠');
    expect(formatMoneyMajor(0.5, 'en')).toBe('0.50');
    // ...and a 1,250.50 invoice that read 1,251.
    expect(formatMoneyMajor(1250.5, 'en')).toBe('1,250.50');
    expect(formatMoneyMajor(1250.5, 'ar')).toBe('١٬٢٥٠٫٥٠');
  });

  it('shapes digits and both separators for ar', () => {
    expect(formatMoneyMajor(1234567.89, 'ar')).toBe('١٬٢٣٤٬٥٦٧٫٨٩');
    expect(formatMoneyMajor(1234567.89, 'en')).toBe('1,234,567.89');
  });

  it('keeps the MINUS — colour alone cannot carry the sign', () => {
    expect(formatMoneyMajor(-500, 'en')).toBe('−500.00');
    expect(formatMoneyMajor(-500, 'ar')).toBe('−٥٠٠٫٠٠');
  });

  it('never renders a negative zero', () => {
    expect(formatMoneyMajor(-0.001, 'en')).toBe('0.00');
    expect(formatMoneyMajor(0, 'ar')).toBe('٠٫٠٠');
  });

  it('honours a non-2 exponent (KWD = 3)', () => {
    expect(formatMoneyMajor(1.234, 'en', 3)).toBe('1.234');
  });

  it('round-trips a minor-unit amount without losing a piastre', () => {
    expect(formatMoneyMajor(fromMinor(2520), 'en')).toBe('25.20');
    expect(formatMoneyMajor(fromMinor(5), 'en')).toBe('0.05');
  });
});

describe('toLocaleDigits / normalizeDigits — the money INPUT boundary', () => {
  it('shapes a canonical value for display', () => {
    expect(toLocaleDigits('25.20', 'ar')).toBe('٢٥٫٢٠');
    expect(toLocaleDigits('25.20', 'en')).toBe('25.20');
  });

  it('normalises back, so parseFloat never sees Arabic-Indic digits', () => {
    // NaN here would silently turn a paid-in-full purchase into a debt.
    expect(normalizeDigits('٢٥٫٢٠')).toBe('25.20');
    expect(parseFloat(normalizeDigits('٢٥٫٢٠'))).toBe(25.2);
    expect(normalizeDigits('25.20')).toBe('25.20');
  });

  it('is a true round-trip', () => {
    expect(normalizeDigits(toLocaleDigits('1250.50', 'ar'))).toBe('1250.50');
  });
});

describe('bidiIsolate', () => {
  it('fences the run so a leading sign cannot be reordered away from its digits', () => {
    expect(bidiIsolate('− ٥٠٠ ج.م')).toBe('⁨− ٥٠٠ ج.م⁩');
  });
});
