import {
  IN,
  OUT,
  signedQty,
  computeOnHand,
  onHandForItem,
  negativeStockViolations,
  itemMovement,
  type PostingDoc,
} from './posting';

const inDoc = (lines: { itemId: string; qty: number }[]): PostingDoc => ({
  status: 'posted',
  direction: IN,
  lines,
});
const outDoc = (lines: { itemId: string; qty: number }[]): PostingDoc => ({
  status: 'posted',
  direction: OUT,
  lines,
});

describe('posting — signed qty', () => {
  it('signs the magnitude by document direction', () => {
    expect(signedQty(10, IN)).toBe(10);
    expect(signedQty(3, OUT)).toBe(-3);
  });
});

describe('posting — on-hand derivation (acceptance §8)', () => {
  it('incoming (A,10) → on-hand 10; then outgoing (A,3) → 7', () => {
    const docs = [inDoc([{ itemId: 'A', qty: 10 }])];
    expect(onHandForItem(docs, 'A')).toBe(10);
    docs.push(outDoc([{ itemId: 'A', qty: 3 }]));
    expect(onHandForItem(docs, 'A')).toBe(7);
  });

  it('draft documents do NOT affect on-hand', () => {
    const docs: PostingDoc[] = [
      inDoc([{ itemId: 'A', qty: 10 }]),
      { status: 'draft', direction: OUT, lines: [{ itemId: 'A', qty: 5 }] },
    ];
    expect(onHandForItem(docs, 'A')).toBe(10);
  });

  it('posting a doc applies its effect exactly once', () => {
    const docs = [inDoc([{ itemId: 'A', qty: 4 }])];
    expect(computeOnHand(docs)).toEqual({ A: 4 });
  });

  it('aggregates multiple items and fractional qty', () => {
    const docs = [
      inDoc([
        { itemId: 'A', qty: 10 },
        { itemId: 'B', qty: 2.5 },
      ]),
      outDoc([{ itemId: 'A', qty: 1 }]),
    ];
    expect(computeOnHand(docs)).toEqual({ A: 9, B: 2.5 });
  });
});

describe('posting — negative-stock guard', () => {
  const onHand = { A: 5 };

  it('blocks an outgoing line that overdraws when allowNegative=false', () => {
    const v = negativeStockViolations(onHand, outDoc([{ itemId: 'A', qty: 8 }]), false);
    expect(v).toEqual([{ itemId: 'A', available: 5, requested: 8 }]);
  });

  it('allows exact-to-zero draw', () => {
    expect(negativeStockViolations(onHand, outDoc([{ itemId: 'A', qty: 5 }]), false)).toEqual([]);
  });

  it('sums two lines of the same item before checking', () => {
    const v = negativeStockViolations(
      onHand,
      outDoc([
        { itemId: 'A', qty: 3 },
        { itemId: 'A', qty: 3 },
      ]),
      false,
    );
    expect(v).toEqual([{ itemId: 'A', available: 5, requested: 6 }]);
  });

  it('treats an unknown item as 0 available', () => {
    const v = negativeStockViolations(onHand, outDoc([{ itemId: 'Z', qty: 1 }]), false);
    expect(v).toEqual([{ itemId: 'Z', available: 0, requested: 1 }]);
  });

  it('allowNegative=true → no violations', () => {
    expect(negativeStockViolations(onHand, outDoc([{ itemId: 'A', qty: 99 }]), true)).toEqual([]);
  });
});

describe('posting — item movement running balance', () => {
  it('produces a cumulative balance whose final value == on-hand', () => {
    const docs = [
      inDoc([{ itemId: 'A', qty: 10 }]),
      outDoc([{ itemId: 'A', qty: 3 }]),
      inDoc([{ itemId: 'A', qty: 5 }]),
    ];
    const rows = itemMovement(docs, 'A');
    expect(rows.map((r) => r.runningBalance)).toEqual([10, 7, 12]);
    expect(rows[rows.length - 1].runningBalance).toBe(onHandForItem(docs, 'A'));
  });

  it('ignores other items and draft docs', () => {
    const docs: PostingDoc[] = [
      inDoc([{ itemId: 'A', qty: 10 }, { itemId: 'B', qty: 4 }]),
      { status: 'draft', direction: OUT, lines: [{ itemId: 'A', qty: 2 }] },
    ];
    const rows = itemMovement(docs, 'A');
    expect(rows).toHaveLength(1);
    expect(rows[0].runningBalance).toBe(10);
  });
});
