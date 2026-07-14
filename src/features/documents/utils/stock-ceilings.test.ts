// THE CEILING IS ON THE ITEM, NOT ON THE ROW.
//
// This is the bug that looks correct: clamp each line against on-hand and every
// obvious test passes — one line of 5 out of 5 on hand, blocked at 6, all green.
// Then he adds the same item on a SECOND row, each row is individually "within
// stock", and he has just sold 10 of the 5 he owns.
//
// `negativeStockViolations` has always aggregated per item. These are the form's
// projections of that same rule, and they aggregate with it.
import type { DocLine } from '../types';
import {
  clampQty,
  headroomForItem,
  lineViolations,
  maxQtyForLine,
  onHandOf,
  requestedByItem,
} from './stock-ceilings';
import type { InventoryItem } from '@/features/inventory/types';

const line = (over: Partial<DocLine> & { id: string }): DocLine => ({
  itemId: 'A',
  name: 'زيت',
  unit: 'piece',
  unitPrice: 20,
  qty: 1,
  ...over,
});

const item = (over: Partial<InventoryItem> & { id: string }): InventoryItem => ({
  name: 'زيت',
  category: 'other',
  unit: 'piece',
  costPriceMinor: 1260,
  salePriceMinor: 2000,
  pricingMode: 'fixed',
  minPriceMinor: null,
  barcode: null,
  qty: 0,
  lowStockThreshold: 2,
  tags: [],
  notes: null,
  ...over,
});

const ON_HAND = { A: 10 };

describe('stock ceilings — one item, one line', () => {
  it('caps the line at the item on-hand', () => {
    const l = line({ id: 'l1', qty: 4 });
    expect(maxQtyForLine(l, [l], ON_HAND, true)).toBe(10);
    expect(clampQty(l, [l], ON_HAND, true, 11)).toBe(10);
    expect(clampQty(l, [l], ON_HAND, true, 7)).toBe(7); // below the ceiling, untouched
  });

  it('an item that has never moved has on-hand 0 — nothing to sell', () => {
    const l = line({ id: 'l1', itemId: 'Z', qty: 1 });
    expect(maxQtyForLine(l, [l], ON_HAND, true)).toBe(0);
    expect(headroomForItem('Z', [], ON_HAND, true)).toBe(0);
  });
});

describe('stock ceilings — THE SUM ACROSS DUPLICATE LINES', () => {
  const l1 = line({ id: 'l1', qty: 4 });
  const l2 = line({ id: 'l2', qty: 3 });
  const lines = [l1, l2];

  it('aggregates requested qty per item, not per row', () => {
    expect(requestedByItem(lines)).toEqual({ A: 7 });
  });

  it("each line's ceiling is on-hand MINUS what the other lines already claim", () => {
    // 10 on hand, the other row claims 3 ⇒ this row may reach 7, not 10.
    expect(maxQtyForLine(l1, lines, ON_HAND, true)).toBe(7);
    expect(maxQtyForLine(l2, lines, ON_HAND, true)).toBe(6); // 10 − 4
  });

  it('refuses to let the second row push the SUM past on-hand', () => {
    // Per-row thinking would allow 10 here (10 ≤ 10) — and sell 14 of 10.
    expect(clampQty(l2, lines, ON_HAND, true, 10)).toBe(6);
    const clamped = [l1, { ...l2, qty: clampQty(l2, lines, ON_HAND, true, 10) }];
    expect(requestedByItem(clamped).A).toBe(10); // exactly on hand, never above
  });

  it('headroom is what the whole document has left of the item', () => {
    expect(headroomForItem('A', lines, ON_HAND, true)).toBe(3); // 10 − 7
    expect(headroomForItem('A', [line({ id: 'x', qty: 10 })], ON_HAND, true)).toBe(0);
  });

  it('reports ONE violation for two rows of the same item, summed', () => {
    const over = [line({ id: 'l1', qty: 6 }), line({ id: 'l2', qty: 6 })];
    expect(lineViolations(over, ON_HAND, true)).toEqual([
      { itemId: 'A', available: 10, requested: 12 },
    ]);
  });
});

describe('stock ceilings — what is NOT constrained', () => {
  it('a fast-entry / CSV line (itemId null) has no known item and no ceiling', () => {
    const adhoc = line({ id: 'l1', itemId: null, qty: 99 });
    expect(maxQtyForLine(adhoc, [adhoc], ON_HAND, true)).toBeNull();
    expect(clampQty(adhoc, [adhoc], ON_HAND, true, 500)).toBe(500);
    expect(requestedByItem([adhoc])).toEqual({}); // invisible to the rule until posted
    expect(lineViolations([adhoc], ON_HAND, true)).toEqual([]);
  });

  it('UNENFORCED (purchase, or allowNegativeStock) → no ceiling, no violations at all', () => {
    const l = line({ id: 'l1', qty: 99 });
    expect(maxQtyForLine(l, [l], ON_HAND, false)).toBeNull();
    expect(clampQty(l, [l], ON_HAND, false, 999)).toBe(999);
    expect(headroomForItem('A', [l], ON_HAND, false)).toBe(Infinity);
    expect(lineViolations([l], ON_HAND, false)).toEqual([]);
  });
});

describe('stock ceilings — on-hand comes from the items the form already holds', () => {
  it('maps InventoryItem.qty (the derived on-hand) by id', () => {
    expect(onHandOf([item({ id: 'A', qty: 10 }), item({ id: 'B', qty: 0 })])).toEqual({
      A: 10,
      B: 0,
    });
  });
});
