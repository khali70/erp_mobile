import {
  toMinor,
  fromMinor,
  toMajor,
  lineTotal,
  formatMoney,
  currencyExponent,
} from './money';

describe('money — minor-unit integer helpers', () => {
  it('toMinor parses decimal strings to integer minor units (round half-up)', () => {
    expect(toMinor('12.50')).toBe(1250);
    expect(toMinor('0.1')).toBe(10);
    expect(toMinor('0.005')).toBe(1); // 0.5 minor rounds up
    expect(toMinor(12.5)).toBe(1250);
  });

  it('toMinor is safe on garbage input', () => {
    expect(toMinor('abc')).toBe(0);
    expect(toMinor('')).toBe(0);
    expect(toMinor(Infinity)).toBe(0);
  });

  it('fromMinor / toMajor invert toMinor for representable values', () => {
    expect(fromMinor(1250)).toBe(12.5);
    expect(toMajor(1250)).toBe('12.50');
    expect(toMajor(5)).toBe('0.05');
  });

  it('no float drift accumulates across a ledger (integer math)', () => {
    // 0.1 + 0.2 in float = 0.30000000000000004; in minor units it is exact.
    const sum = toMinor('0.1') + toMinor('0.2');
    expect(sum).toBe(30);
    expect(toMajor(sum)).toBe('0.30');
  });

  it('lineTotal rounds a fractional qty × unit price once, half-up', () => {
    expect(lineTotal(2, 350)).toBe(700);
    expect(lineTotal(1.5, 100)).toBe(150); // 1.5 kg × 1.00
    expect(lineTotal(0.333, 100)).toBe(33); // 33.3 → 33
    expect(lineTotal(0.335, 100)).toBe(34); // 33.5 → 34 (half-up)
  });

  it('respects per-currency exponent', () => {
    expect(currencyExponent('KWD')).toBe(3);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('EGP')).toBe(2);
    expect(toMinor('1.234', 'KWD')).toBe(1234);
    expect(toMajor(1234, 'KWD')).toBe('1.234');
    expect(toMinor('100', 'JPY')).toBe(100);
  });

  it('formatMoney appends the currency code', () => {
    expect(formatMoney(1250)).toBe('12.50 EGP');
    expect(formatMoney(1234, 'KWD')).toBe('1.234 KWD');
  });
});
