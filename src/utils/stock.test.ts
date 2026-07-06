import { getStockStatus } from './stock';

describe('getStockStatus', () => {
  it('is out when on-hand is zero or negative', () => {
    expect(getStockStatus(0, 5)).toBe('out');
    expect(getStockStatus(-3, 5)).toBe('out');
  });

  it('is low when on-hand is at or below the threshold', () => {
    expect(getStockStatus(5, 5)).toBe('low');
    expect(getStockStatus(1, 5)).toBe('low');
  });

  it('is inStock above the threshold', () => {
    expect(getStockStatus(6, 5)).toBe('inStock');
  });

  it('with a zero threshold, any positive qty is inStock', () => {
    expect(getStockStatus(1, 0)).toBe('inStock');
    expect(getStockStatus(0, 0)).toBe('out');
  });
});
