import {
  isValueMasked,
  isAnythingRevealed,
  maskRun,
  MASK_DOT_COUNT,
  type RevealState,
} from './privacy';

const masked: RevealState = { revealed: false, revealedCards: {} };

describe('isValueMasked', () => {
  it('masks nothing when privacy mode is off', () => {
    expect(isValueMasked(false, masked, 'kpi:stockValue')).toBe(false);
  });

  it('masks a value when privacy mode is on and nothing is revealed', () => {
    expect(isValueMasked(true, masked, 'kpi:stockValue')).toBe(true);
  });

  it('unmasks every value on a whole-app reveal', () => {
    const state: RevealState = { revealed: true, revealedCards: {} };
    expect(isValueMasked(true, state, 'kpi:stockValue')).toBe(false);
    expect(isValueMasked(true, state, 'kpi:profit')).toBe(false);
  });

  it('a per-value reveal leaves the other values masked', () => {
    const state: RevealState = {
      revealed: false,
      revealedCards: { 'kpi:stockValue': true },
    };
    expect(isValueMasked(true, state, 'kpi:stockValue')).toBe(false);
    expect(isValueMasked(true, state, 'kpi:profit')).toBe(true);
  });
});

describe('isAnythingRevealed', () => {
  it('is false when fully masked', () => {
    expect(isAnythingRevealed(masked)).toBe(false);
  });

  it('is true on a whole-app reveal', () => {
    expect(isAnythingRevealed({ revealed: true, revealedCards: {} })).toBe(true);
  });

  it('is true on a single per-value reveal', () => {
    expect(
      isAnythingRevealed({ revealed: false, revealedCards: { 'party:1': true } }),
    ).toBe(true);
  });

  it('ignores stale false entries', () => {
    expect(
      isAnythingRevealed({ revealed: false, revealedCards: { 'party:1': false } }),
    ).toBe(false);
  });
});

describe('maskRun', () => {
  it('defaults to the standard dot count', () => {
    expect(maskRun()).toHaveLength(MASK_DOT_COUNT);
    expect(maskRun()).toBe('••••••');
  });

  it('leaks no digits', () => {
    expect(maskRun(4)).toBe('••••');
    expect(/\d/.test(maskRun(10))).toBe(false);
  });
});
