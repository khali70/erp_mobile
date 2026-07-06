import {
  formatDocNumber,
  nextSequence,
  parseSequence,
  nextDocNumber,
} from './numbering';

describe('doc numbering', () => {
  it('formats zero-padded per-kind numbers', () => {
    expect(formatDocNumber('incoming', 1)).toBe('IN-000001');
    expect(formatDocNumber('outgoing', 45)).toBe('OUT-000045');
    expect(formatDocNumber('incoming', 123456)).toBe('IN-123456');
  });

  it('nextSequence starts at 1 and increments', () => {
    expect(nextSequence(null)).toBe(1);
    expect(nextSequence(undefined)).toBe(1);
    expect(nextSequence(0)).toBe(1);
    expect(nextSequence(41)).toBe(42);
  });

  it('parseSequence reads the numeric tail, null on garbage', () => {
    expect(parseSequence('IN-000007')).toBe(7);
    expect(parseSequence('OUT-000045')).toBe(45);
    expect(parseSequence('nope')).toBeNull();
  });

  it('nextDocNumber chains off the last number of the same kind', () => {
    expect(nextDocNumber('incoming', null)).toBe('IN-000001');
    expect(nextDocNumber('incoming', 'IN-000009')).toBe('IN-000010');
    expect(nextDocNumber('outgoing', 'OUT-000045')).toBe('OUT-000046');
  });
});
