import {
  EMPTY_ADVANCED_FILTERS,
  UNCATEGORIZED,
  countActiveFilters,
  filterItems,
  normalizeRange,
  parseBound,
  parseMinorBound,
  type AdvancedItemFilters,
} from './filterItems';
import type { InventoryItem } from '../types';

function item(over: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    name: 'صنف',
    category: 'tshirts',
    unit: 'piece',
    costPriceMinor: 10_000,
    salePriceMinor: 20_000,
    pricingMode: 'fixed',
    minPriceMinor: null,
    barcode: null,
    qty: 5,
    lowStockThreshold: 2,
    tags: [],
    notes: null,
    ...over,
  };
}

const filters = (over: Partial<AdvancedItemFilters> = {}): AdvancedItemFilters => ({
  ...EMPTY_ADVANCED_FILTERS,
  ...over,
});

const ids = (rows: InventoryItem[]) => rows.map((r) => r.id);

const run = (rows: InventoryItem[], over: Partial<AdvancedItemFilters> = {}, query = '', stock: 'all' | 'low' | 'out' = 'all') =>
  filterItems(rows, { query, stock, advanced: filters(over) });

describe('parseBound', () => {
  it('treats blank as unbounded', () => {
    expect(parseBound('')).toBeNull();
    expect(parseBound('   ')).toBeNull();
  });

  it('reads Arabic-Indic digits and the Arabic decimal mark', () => {
    expect(parseBound('٢٥٫٥')).toBe(25.5);
  });

  it('rejects garbage rather than producing NaN', () => {
    expect(parseBound('abc')).toBeNull();
  });
});

describe('parseMinorBound', () => {
  it('converts major EGP to integer minor units', () => {
    expect(parseMinorBound('25.5')).toBe(2550);
    expect(parseMinorBound('0')).toBe(0);
    expect(Number.isInteger(parseMinorBound('19.99'))).toBe(true);
  });
});

describe('normalizeRange', () => {
  it('swaps an inverted range instead of emptying the list', () => {
    expect(normalizeRange(500, 100)).toEqual({ min: 100, max: 500 });
  });

  it('leaves half-open ranges alone', () => {
    expect(normalizeRange(null, 100)).toEqual({ min: null, max: 100 });
    expect(normalizeRange(100, null)).toEqual({ min: 100, max: null });
  });
});

describe('filterItems — categories', () => {
  const rows = [
    item({ id: 'a', category: 'tshirts' }),
    item({ id: 'b', category: 'shoes' }),
    item({ id: 'c', category: '' }),
  ];

  it('no selection means no constraint', () => {
    expect(ids(run(rows))).toEqual(['a', 'b', 'c']);
  });

  it('matches any selected category', () => {
    expect(ids(run(rows, { categories: ['tshirts', 'shoes'] }))).toEqual(['a', 'b']);
  });

  it('matches uncategorized items through the sentinel', () => {
    expect(ids(run(rows, { categories: [UNCATEGORIZED] }))).toEqual(['c']);
  });

  it('ignores a stale (deleted) category selection gracefully', () => {
    expect(ids(run(rows, { categories: ['deleted-category'] }))).toEqual([]);
  });
});

describe('filterItems — money ranges', () => {
  const rows = [
    item({ id: 'a', salePriceMinor: 5_000, costPriceMinor: 2_000 }),
    item({ id: 'b', salePriceMinor: 15_000, costPriceMinor: 9_000 }),
    item({ id: 'c', salePriceMinor: 30_000, costPriceMinor: 25_000 }),
  ];

  it('compares the sale price in minor units against major-unit bounds', () => {
    expect(ids(run(rows, { salePriceMin: '100', salePriceMax: '200' }))).toEqual(['b']);
  });

  it('leaves a blank bound unbounded', () => {
    expect(ids(run(rows, { salePriceMin: '150' }))).toEqual(['b', 'c']);
    expect(ids(run(rows, { salePriceMax: '150' }))).toEqual(['a', 'b']);
  });

  it('filters the supplier price independently', () => {
    expect(ids(run(rows, { costPriceMax: '90' }))).toEqual(['a', 'b']);
  });

  it('survives an inverted range by swapping the bounds', () => {
    expect(ids(run(rows, { salePriceMin: '200', salePriceMax: '100' }))).toEqual(['b']);
  });

  it('accepts very large bounds', () => {
    expect(ids(run(rows, { salePriceMax: '99999999' }))).toEqual(['a', 'b', 'c']);
  });

  it('includes rows exactly on a bound', () => {
    expect(ids(run(rows, { salePriceMin: '50', salePriceMax: '50' }))).toEqual(['a']);
  });
});

describe('filterItems — quantity, pricing mode, tags', () => {
  const rows = [
    item({ id: 'a', qty: 0, pricingMode: 'fixed', tags: ['صيفي'] }),
    item({ id: 'b', qty: 2, pricingMode: 'negotiable', tags: ['شتوي', 'مميز'] }),
    item({ id: 'c', qty: 40, pricingMode: 'fixed', tags: [] }),
  ];

  it('filters on quantity on hand', () => {
    expect(ids(run(rows, { qtyMin: '1', qtyMax: '10' }))).toEqual(['b']);
  });

  it('filters on pricing mode', () => {
    expect(ids(run(rows, { pricingMode: 'negotiable' }))).toEqual(['b']);
    expect(ids(run(rows, { pricingMode: 'fixed' }))).toEqual(['a', 'c']);
  });

  it('matches items carrying ANY selected tag, and excludes untagged items', () => {
    expect(ids(run(rows, { tags: ['صيفي', 'مميز'] }))).toEqual(['a', 'b']);
    expect(ids(run(rows, { tags: ['شتوي'] }))).toEqual(['b']);
  });
});

describe('filterItems — combination', () => {
  const rows = [
    item({ id: 'a', name: 'تيشيرت أبيض', category: 'tshirts', qty: 1, salePriceMinor: 10_000, tags: ['صيفي'] }),
    item({ id: 'b', name: 'تيشيرت أسود', category: 'tshirts', qty: 30, salePriceMinor: 10_000, tags: ['صيفي'] }),
    item({ id: 'c', name: 'حذاء', category: 'shoes', qty: 1, salePriceMinor: 90_000, tags: ['صيفي'] }),
  ];

  it('ANDs every dimension and stacks the search on top', () => {
    const out = filterItems(rows, {
      query: 'تيشيرت',
      stock: 'low',
      advanced: filters({ categories: ['tshirts'], salePriceMax: '150', tags: ['صيفي'] }),
    });
    expect(ids(out)).toEqual(['a']);
  });

  it('keeps the barcode search path', () => {
    const rowsWithCode = [item({ id: 'a', barcode: '12345' }), item({ id: 'b', barcode: '99999' })];
    expect(ids(run(rowsWithCode, {}, '123'))).toEqual(['a']);
  });

  it('filters out-of-stock rows through the stock chip', () => {
    expect(ids(run(rows, {}, '', 'out'))).toEqual([]);
  });
});

describe('countActiveFilters', () => {
  it('counts nothing when untouched', () => {
    expect(countActiveFilters(filters())).toBe(0);
  });

  it('counts a range once whether one or both bounds are set', () => {
    expect(countActiveFilters(filters({ salePriceMin: '10' }))).toBe(1);
    expect(countActiveFilters(filters({ salePriceMin: '10', salePriceMax: '20' }))).toBe(1);
  });

  it('counts each dimension separately', () => {
    const active = filters({
      categories: ['tshirts'],
      salePriceMin: '10',
      costPriceMax: '5',
      qtyMin: '1',
      pricingMode: 'fixed',
      tags: ['صيفي'],
    });
    expect(countActiveFilters(active)).toBe(6);
  });

  it('ignores a blank or unparseable bound', () => {
    expect(countActiveFilters(filters({ qtyMin: '   ', qtyMax: 'abc' }))).toBe(0);
  });
});
