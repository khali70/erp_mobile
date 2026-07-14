import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { createExpenseRepository, InvalidExpenseError } from './expense-repository';
import { createTransactionRepository } from './transaction-repository';
import * as schema from '@/db/schema';

// FIXED clock. Never Date.now() — a repository that reads the wall clock makes a
// test that flakes at midnight. All money is INTEGER minor units (piasters):
// 200 ج.م rent === 20000.
const T0 = 1_760_000_000_000;
const DAY = 86_400_000;

let db: TestDb;
let expenses: ReturnType<typeof createExpenseRepository>;
let txs: ReturnType<typeof createTransactionRepository>;

beforeEach(() => {
  db = makeTestDb();
  expenses = createExpenseRepository(db, () => T0);
  txs = createTransactionRepository(db, () => T0);
});

/** The rent: an obligation with no goods, no lines, and no document at all. */
const rent = (total = 20000, at = T0) =>
  expenses.create({
    title: 'إيجار المحل',
    category: 'rent',
    totalAmount: total,
    incurredAt: at,
    partyName: 'الحاج مصطفى', // FREE TEXT — the landlord is not a supplier
  }).id;

/** Pay an expense — the SAME cash-book row the سداد sheet writes for a supplier. */
const pay = (expenseId: string, amount: number, at = T0) =>
  txs.create({
    direction: -1,
    amount,
    occurredAt: at,
    account: 'cash',
    refKind: 'expense',
    refId: expenseId,
  });

describe('expenses are real, persisted data (they survive closing the app)', () => {
  it('round-trips through SQL — title, category, party, and INTEGER minor units', () => {
    const id = rent(20000, T0 - 3 * DAY);

    const e = expenses.get(id)!;
    expect(e).toMatchObject({
      title: 'إيجار المحل',
      category: 'rent',
      totalAmount: 20000, // minor units, never a float
      incurredAt: T0 - 3 * DAY,
      partyName: 'الحاج مصطفى',
    });
    expect(Number.isInteger(e.totalAmount)).toBe(true);
    expect(expenses.list()).toHaveLength(1);
  });

  it('has NO paid column — the row itself knows nothing about what was paid', () => {
    const id = rent();
    pay(id, 5000);

    // The schema deliberately cannot answer "is this paid?". Only the
    // transactions can, which is why the two can never disagree.
    const row = db.select().from(schema.expenses).all()[0];
    expect(Object.keys(row)).not.toContain('paid');
    expect(Object.keys(row)).not.toContain('settled');
    expect(row.totalAmount).toBe(20000); // untouched by the payment
    expect(expenses.owed(id)).toBe(15000); // ...and yet the debt is right
  });

  it('rejects a non-integer or non-positive amount — money is minor units, always', () => {
    expect(() => expenses.create({ title: 'x', totalAmount: 12.5 })).toThrow(InvalidExpenseError);
    expect(() => expenses.create({ title: 'x', totalAmount: 0 })).toThrow(InvalidExpenseError);
    expect(() => expenses.create({ title: 'x', totalAmount: -100 })).toThrow(InvalidExpenseError);
    expect(() => expenses.create({ title: '  ', totalAmount: 100 })).toThrow(InvalidExpenseError);
    expect(expenses.list()).toHaveLength(0);
  });

  it('lists most recently incurred first', () => {
    expenses.create({ title: 'كهرباء', totalAmount: 300, incurredAt: T0 - 5 * DAY });
    expenses.create({ title: 'بنزين', totalAmount: 220, incurredAt: T0 - DAY });
    expect(expenses.list().map((e) => e.title)).toEqual(['بنزين', 'كهرباء']);
  });
});

describe('TC-5.3 — a partly-paid expense is still debt', () => {
  // The heart of the epic: an expense's debt is derived by the SAME subtraction
  // as a supplier's. One concept, not two.
  it('rent 20000 with a 5000 payment leaves 15000 owed, and it still reads UNPAID', () => {
    const id = rent(20000);

    pay(id, 5000, T0 + 2 * DAY);

    expect(expenses.owed(id)).toBe(15000);
    expect(expenses.paidOn(id)).toBe(5000);

    const [e] = expenses.listWithDebt();
    expect(e).toMatchObject({ paid: 5000, remaining: 15000, status: 'partial' });

    // Still on the books. A bill that is 25% paid is still a bill.
    expect(expenses.listUnpaid().map((x) => x.id)).toEqual([id]);
    expect(expenses.payableTotal()).toBe(15000);

    // ONE cash-book row, pointing at the expense — the same shape a supplier
    // payment takes, written by the same سداد sheet.
    const rows = txs.listByRef('expense', id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ direction: -1, amount: 5000, refKind: 'expense', refId: id });
    expect(txs.cashByAccount('cash')).toBe(-5000);
  });

  it('paying it off in full drops it out of what is owed — with no settled flag anywhere', () => {
    const id = rent(20000);

    pay(id, 5000);
    pay(id, 15000, T0 + 3 * DAY); // the rest, later

    expect(expenses.owed(id)).toBe(0);
    expect(expenses.listWithDebt()[0].status).toBe('paid');
    expect(expenses.listUnpaid()).toEqual([]);
    expect(expenses.payableTotal()).toBe(0);

    // Nothing was flagged, updated or cached. Two payment rows, and that is all.
    expect(db.select().from(schema.transactions).all()).toHaveLength(2);
  });

  it('an untouched expense is UNPAID, never "partial" — 0 paid is not a payment', () => {
    rent(20000);
    expect(expenses.listWithDebt()[0]).toMatchObject({
      paid: 0,
      remaining: 20000,
      status: 'unpaid',
    });
  });

  it('a SOFT-DELETED payment stops counting — the debt comes back', () => {
    const id = rent(20000);
    const txId = pay(id, 5000);

    txs.archive(txId);

    expect(expenses.owed(id)).toBe(20000); // a payment that was undone paid nothing
    expect(expenses.payableTotal()).toBe(20000);
  });

  it('debt is per-expense and never leaks between them', () => {
    const a = rent(20000);
    const b = expenses.create({ title: 'كهرباء', totalAmount: 3000 }).id;

    pay(a, 5000);

    expect(expenses.owed(a)).toBe(15000);
    expect(expenses.owed(b)).toBe(3000);
    expect(expenses.payableTotal()).toBe(18000);
  });
});

describe('an OVER-PAID expense is a receivable, and must not shrink payables', () => {
  it('paying 25000 against 20000 rent goes negative — never clamped, never netted in', () => {
    const id = rent(20000);

    pay(id, 25000);

    // Negative = the shop is owed 5000 back. Clamping it to zero here would
    // silently swallow 5000 of the owner's money and he would never find it.
    expect(expenses.owed(id)).toBe(-5000);
    expect(expenses.listWithDebt()[0]).toMatchObject({ remaining: -5000, status: 'paid' });

    // ...and it does NOT count as a payable.
    expect(expenses.payableTotal()).toBe(0);
    expect(expenses.listUnpaid()).toEqual([]);
  });

  it('an over-payment on ONE expense does not reduce what is owed on ANOTHER', () => {
    const over = rent(20000);
    const bill = expenses.create({ title: 'كهرباء', totalAmount: 3000 }).id;

    pay(over, 25000); // 5000 over-paid

    // The bug this guards: Σ(remaining) would give 3000 − 5000 = −2000, and the
    // KPI would report the shop owes NOTHING while a 3000 electricity bill sits
    // unpaid on the counter. Only POSITIVE remainders are summed.
    expect(expenses.payableTotal()).toBe(3000);
    expect(expenses.listUnpaid().map((e) => e.id)).toEqual([bill]);
  });
});

describe('a SOFT-DELETED expense vanishes from every figure', () => {
  it('is gone from the list, from owed(), and from payables', () => {
    const id = rent(20000);
    const kept = expenses.create({ title: 'كهرباء', totalAmount: 3000 }).id;
    expect(expenses.payableTotal()).toBe(23000);

    expenses.archive(id);

    expect(expenses.get(id)).toBeNull();
    expect(expenses.list().map((e) => e.id)).toEqual([kept]);
    expect(expenses.listWithDebt().map((e) => e.id)).toEqual([kept]);
    expect(expenses.listUnpaid().map((e) => e.id)).toEqual([kept]);
    expect(expenses.owed(id)).toBe(0); // an archived bill is owed to nobody
    expect(expenses.payableTotal()).toBe(3000);

    // The row is still THERE — soft delete, not a hole in the history.
    expect(db.select().from(schema.expenses).all()).toHaveLength(2);
  });

  it('a soft-deleted expense that had been part-paid still owes nothing', () => {
    const id = rent(20000);
    pay(id, 5000);
    expenses.archive(id);

    expect(expenses.owed(id)).toBe(0);
    expect(expenses.payableTotal()).toBe(0);
  });
});

describe('totalIncurredBetween — what the month COST (not what is owed on it)', () => {
  it('sums live expenses in the window, regardless of what has been paid', () => {
    rent(20000, T0);
    expenses.create({ title: 'كهرباء', totalAmount: 3000, incurredAt: T0 + DAY });
    expenses.create({ title: 'قديم', totalAmount: 9999, incurredAt: T0 - 40 * DAY }); // outside
    pay(rent(5000, T0 + 2 * DAY), 5000); // paid in full — still an expense that happened

    expect(expenses.totalIncurredBetween(T0 - DAY, T0 + 10 * DAY)).toBe(28000);
  });
});
