import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { createDocumentRepository, InvalidPaymentError } from './document-repository';
import { createTransactionRepository } from './transaction-repository';
import { createSupplierRepository } from './supplier-repository';
import { createCustomerRepository } from './customer-repository';
import { createDebtRepository, walkFifo } from './debt-repository';
import * as schema from '@/db/schema';

// FIXED clock. Never Date.now() — a test that depends on the wall clock will
// flake, and aging assertions will flake first. All money is INTEGER minor
// units (piasters): 60 ج.م === 6000.
const T0 = 1_760_000_000_000;
const DAY = 86_400_000;

let db: TestDb;
let docs: ReturnType<typeof createDocumentRepository>;
let txs: ReturnType<typeof createTransactionRepository>;
let suppliers: ReturnType<typeof createSupplierRepository>;
let debts: ReturnType<typeof createDebtRepository>;

beforeEach(() => {
  db = makeTestDb();
  docs = createDocumentRepository(db);
  txs = createTransactionRepository(db, () => T0);
  suppliers = createSupplierRepository(db, () => T0);
  debts = createDebtRepository(db);
  seedSentinels(db, T0);
});

const addSupplier = (name: string, phone: string | null = null) =>
  suppliers.create({ name, phone }).id;

/** A debt repo whose "now" is a FIXED point in the future — for aging only. */
const debtsAt = (at: number) => createDebtRepository(db, () => at);

/** A standalone payment, days after the invoice closed (the سداد sheet's write). */
const pay = (
  supplierId: string,
  amount: number,
  opts: { at?: number; account?: 'cash' | 'instapay' } = {},
) =>
  txs.create({
    direction: -1,
    amount,
    occurredAt: opts.at ?? T0,
    account: opts.account ?? 'cash',
    refKind: 'supplier',
    refId: supplierId,
  });

/** A posted purchase of `total` minor units from `partyId`, optionally part-paid. */
function purchase(
  partyId: string,
  total: number,
  payments?: { amount: number; account: 'cash' | 'instapay' }[],
  opts: { qty?: number; itemId?: string; docDate?: number } = {},
) {
  const qty = opts.qty ?? 1;
  return docs.create({
    kind: 'incoming',
    status: 'posted',
    partyId,
    docDate: opts.docDate ?? T0,
    lines: [{ itemId: opts.itemId ?? 'X', qty, unitPrice: total / qty }],
    payments,
  });
}

const txCount = () => db.select().from(schema.transactions).all().length;

describe('TC-1 — buying merchandise on debt', () => {
  // TC-1.1 — the critical assertion is the ZERO. No money moved, so the cash
  // book must not claim otherwise.
  it('TC-1.1: paid=0 writes NO transaction row, and the full total becomes debt', () => {
    const ahmed = addSupplier('Ahmed');
    const id = purchase(ahmed, 6000, [], { qty: 3 }); // 3 × 2000

    expect(docs.list()).toHaveLength(1);
    expect(docs.getWithLines(id)!.lines).toHaveLength(1);
    expect(txCount()).toBe(0); // ← no money moved
    expect(debts.owed(ahmed)).toBe(6000);
    expect(txs.cashByAccount('cash')).toBe(0);
    expect(docs.onHand('X')).toBe(3); // stock still arrived — goods ≠ money
  });

  it('TC-1.2: debt accumulates across invoices (a sum over documents, not a flag)', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000);
    purchase(ahmed, 4000);
    expect(debts.owed(ahmed)).toBe(10000);
  });

  it('TC-1.3: debt is per-supplier and never leaks between them', () => {
    const ahmed = addSupplier('Ahmed');
    const mahmoud = addSupplier('Mahmoud');
    purchase(ahmed, 6000);
    purchase(mahmoud, 4000);

    expect(debts.owed(ahmed)).toBe(6000);
    expect(debts.owed(mahmoud)).toBe(4000);
    expect(debts.payables().total).toBe(10000);
  });

  it('TC-1.4: a walk-in purchase points at the SENTINEL, never null, and moves cash', () => {
    const id = purchase(WALKIN_SUPPLIER_ID, 6000, [{ amount: 6000, account: 'cash' }]);

    expect(docs.getWithLines(id)!.partyId).toBe(WALKIN_SUPPLIER_ID); // never null
    const [tx] = txs.listByRef('supplier', WALKIN_SUPPLIER_ID);
    expect(tx).toMatchObject({
      direction: -1,
      amount: 6000,
      account: 'cash',
      refKind: 'supplier',
      refId: WALKIN_SUPPLIER_ID,
    });
    expect(txs.cashByAccount('cash')).toBe(-6000);
  });

  it('TC-1.4: a walk-in purchase left underpaid is REJECTED — a sentinel must never carry debt', () => {
    expect(() => purchase(WALKIN_SUPPLIER_ID, 6000, [{ amount: 2000, account: 'cash' }])).toThrow(
      InvalidPaymentError,
    );
    // and it rolled back with the document
    expect(docs.list()).toHaveLength(0);
    expect(txCount()).toBe(0);
  });

  // TC-1.5 — the two filters that carry the whole feature. Half the bugs here
  // would be a forgotten draft or soft-delete, producing a number that is
  // plausible, undetectable and wrong.
  it('TC-1.5: DRAFT and SOFT-DELETED purchases create no debt', () => {
    const ahmed = addSupplier('Ahmed');

    docs.create({
      kind: 'incoming',
      status: 'draft', // never posted — nothing was taken from anyone
      partyId: ahmed,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 5000 }],
    });
    const deleted = purchase(ahmed, 7000);
    docs.remove(deleted);

    expect(debts.owed(ahmed)).toBe(0);
    expect(debts.payables().total).toBe(0);
  });
});

describe('TC-2 — paying part of the money', () => {
  it('TC-2.1: partial payment at delivery leaves the remainder as debt', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);

    const rows = txs.listByRef('supplier', ahmed);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: -1,
      amount: 2000,
      account: 'cash',
      refKind: 'supplier',
      refId: ahmed,
      occurredAt: T0, // the money moved when the document was dated
    });
    expect(debts.owed(ahmed)).toBe(4000);
    expect(txs.cashByAccount('cash')).toBe(-2000);
  });

  it('TC-2.4: paid in full → zero debt, and exactly ONE transaction row (not zero)', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 6000, account: 'cash' }]);

    // The money really did move. A cash book that omits it is a cash book with
    // a hole in it, even though the debt nets to zero.
    expect(txCount()).toBe(1);
    expect(debts.owed(ahmed)).toBe(0);
    expect(txs.cashByAccount('cash')).toBe(-6000);
  });

  it('TC-2.5: OVERPAYMENT yields a negative balance (credit) — never throws, never clamps', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 2500, [{ amount: 2500, account: 'cash' }]);
    purchase(ahmed, 2500); // unpaid → owed 2500

    expect(debts.owed(ahmed)).toBe(2500);

    // Paying 4000 against 2500 owed, later, from the debts screen.
    expect(() =>
      txs.create({
        direction: -1,
        amount: 4000,
        occurredAt: T0 + 10 * DAY,
        account: 'cash',
        refKind: 'supplier',
        refId: ahmed,
      }),
    ).not.toThrow();

    expect(debts.owed(ahmed)).toBe(-1500); // Ahmed owes YOU 1500 — رصيد لك

    // A credit is a receivable, not a payable: it must not net against, or
    // silently reduce, what the shop owes everybody else.
    expect(debts.payables().total).toBe(0);
  });

  it('TC-2.6: paid < 0 is rejected; paid > total at delivery is rejected', () => {
    const ahmed = addSupplier('Ahmed');
    expect(() => purchase(ahmed, 6000, [{ amount: -100, account: 'cash' }])).toThrow();
    expect(() => purchase(ahmed, 6000, [{ amount: 9000, account: 'cash' }])).toThrow(
      InvalidPaymentError,
    );
    expect(docs.list()).toHaveLength(0); // both rolled back
    expect(txCount()).toBe(0);
  });

  it('TC-2.7: a payment SPLIT across both pockets writes two rows, one per pocket', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [
      { amount: 2000, account: 'cash' },
      { amount: 1000, account: 'instapay' },
    ]);

    const rows = txs.listByRef('supplier', ahmed);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.refKind === 'supplier')).toBe(true);
    expect(debts.owed(ahmed)).toBe(3000);
    expect(txs.cashByAccount('cash')).toBe(-2000);
    expect(txs.cashByAccount('instapay')).toBe(-1000);
  });

  it('TC-2.3: paying the rest later clears the debt entirely', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);

    txs.create({
      direction: -1,
      amount: 4000,
      occurredAt: T0 + 10 * DAY, // ten days after the invoice closed
      account: 'cash',
      refKind: 'supplier',
      refId: ahmed,
    });

    expect(debts.owed(ahmed)).toBe(0);
    expect(debts.payables().total).toBe(0);
  });

  it('a SOFT-DELETED payment stops counting — the debt comes back', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);
    const [tx] = txs.listByRef('supplier', ahmed);

    txs.archive(tx.id);

    expect(debts.owed(ahmed)).toBe(6000); // a payment that was undone paid nothing
    expect(txs.cashByAccount('cash')).toBe(0);
  });
});

describe('TC-9.3 — the sentinel is excluded from every debt figure', () => {
  it('never appears in debt or payables, even holding a legacy underpaid balance', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 4000);

    // Simulate data predating the fully-paid invariant (an import, or a legacy
    // row): a walk-in purchase that was never fully settled. Written straight to
    // the table, bypassing the repository guard that now forbids it.
    db.insert(schema.documents)
      .values({
        id: 'legacy-walkin',
        createdAt: T0,
        updatedAt: T0,
        deletedAt: null,
        kind: 'in',
        direction: -1,
        status: 'posted',
        docNo: 'IN-000099',
        docDate: T0,
        totalAmount: 500,
        postedAt: T0,
        partyId: WALKIN_SUPPLIER_ID,
        note: null,
        attachments: null,
      })
      .run();

    // Without this guard the owner's KPI would read "بدون مورد owes you 500" —
    // a debt to nobody, which he can neither act on nor reconcile.
    expect(debts.owed(WALKIN_SUPPLIER_ID)).toBe(0);
    expect(debts.owedBySupplier().has(WALKIN_SUPPLIER_ID)).toBe(false);
    expect(debts.payables().total).toBe(4000); // Ahmed only

    // ...and the debts LIST honours it too. Two independent guards, because the
    // failure mode is a row the owner can neither act on nor reconcile: he
    // cannot go and pay "بدون مورد".
    expect(debts.list().map((r) => r.id)).toEqual([ahmed]);
    expect(debts.settlements(WALKIN_SUPPLIER_ID)).toEqual([]);
    expect(debts.detail(WALKIN_SUPPLIER_ID)).toEqual({
      owed: 0,
      invoices: [],
      payments: [],
      credit: 0,
    });
  });
});

describe('TC-5.1 — the debts list: who I owe, worst first', () => {
  it('contains exactly the suppliers with owed > 0, sorted by amount DESCENDING', () => {
    const ahmed = addSupplier('Ahmed', '0100');
    const mahmoud = addSupplier('Mahmoud', '0111');
    const sayed = addSupplier('Sayed');

    purchase(ahmed, 4000);
    purchase(mahmoud, 3000, [{ amount: 3000, account: 'cash' }]); // fully paid
    purchase(sayed, 1500);

    const rows = debts.list();

    // Mahmoud is settled. He is not a debt, and a screen whose whole job is
    // "who do I pay next" must not list a man the shop owes nothing.
    expect(rows.map((r) => r.name)).toEqual(['Ahmed', 'Sayed']);
    expect(rows.map((r) => r.owed)).toEqual([4000, 1500]);
    expect(rows[0]).toMatchObject({ id: ahmed, phone: '0100' });
  });

  it('TC-2.3: a supplier paid off later DISAPPEARS from the list', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);
    expect(debts.list().map((r) => r.name)).toEqual(['Ahmed']);

    pay(ahmed, 4000, { at: T0 + 10 * DAY }); // ten days after the invoice closed

    expect(debts.owed(ahmed)).toBe(0);
    expect(debts.list()).toEqual([]); // nothing left to pay → nothing to show
  });

  it('a supplier in CREDIT is not a debt and is not listed as one', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 2500);
    pay(ahmed, 4000);

    expect(debts.owed(ahmed)).toBe(-1500);
    expect(debts.list()).toEqual([]); // a receivable is not a payable
  });

  it('a DRAFT invoice puts nobody on the list', () => {
    const ahmed = addSupplier('Ahmed');
    docs.create({
      kind: 'incoming',
      status: 'draft',
      partyId: ahmed,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 5000 }],
    });
    expect(debts.list()).toEqual([]);
  });
});

describe('TC-5.4 — invoice-level FIFO breakdown (derived, never stored)', () => {
  // The most important test in the epic. There are NO allocation rows in this
  // database; the breakdown is a read-time walk of invoices oldest-first against
  // the pool of what the supplier has been paid.
  it('one 4000 payment settles invoice A (2500) in full and leaves B partial (1500 of 2500)', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 2500, [], { docDate: T0 }); // A — older
    purchase(ahmed, 2500, [], { docDate: T0 + 2 * DAY }); // B — newer

    pay(ahmed, 4000, { at: T0 + 5 * DAY });

    const [a, b] = debts.settlements(ahmed);

    expect(a).toMatchObject({ total: 2500, paid: 2500, remaining: 0, status: 'settled' });
    expect(b).toMatchObject({ total: 2500, paid: 1500, remaining: 1000, status: 'partial' });
    expect(debts.owed(ahmed)).toBe(1000);

    // The walk can never disagree with the total: Σ remaining IS the debt.
    expect(a.remaining + b.remaining).toBe(debts.owed(ahmed));

    // ...and it stored nothing to disagree WITH. No allocation table, no
    // paid_amount column, no settled flag — one payment row, and that is all.
    const rows = db.select().from(schema.transactions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refKind: 'supplier', refId: ahmed, amount: 4000 });
  });

  it('is oldest-first by doc date — entry order only breaks a same-day tie', () => {
    const ahmed = addSupplier('Ahmed');
    // Entered newest-first, deliberately: the walk must follow the DATES, not
    // the order the rows happen to sit in the table.
    purchase(ahmed, 1000, [], { docDate: T0 + 3 * DAY, itemId: 'B' });
    purchase(ahmed, 1000, [], { docDate: T0, itemId: 'A' });

    pay(ahmed, 1000);

    const walked = debts.settlements(ahmed);
    expect(walked.map((s) => s.docDate)).toEqual([T0, T0 + 3 * DAY]);
    expect(walked.map((s) => s.status)).toEqual(['settled', 'unpaid']);
  });

  it('an unpaid invoice reads "unpaid", never "partial" — 0 paid is not a payment', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 3000);
    expect(debts.settlements(ahmed)[0]).toMatchObject({
      paid: 0,
      remaining: 3000,
      status: 'unpaid',
    });
  });

  it('detail() carries the payment history alongside the walk', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);
    pay(ahmed, 1000, { at: T0 + 3 * DAY, account: 'instapay' });

    const detail = debts.detail(ahmed);

    expect(detail.owed).toBe(3000);
    expect(detail.invoices).toHaveLength(1);
    expect(detail.invoices[0]).toMatchObject({ paid: 3000, remaining: 3000, status: 'partial' });
    // Oldest money first, and each row says which pocket it came out of.
    expect(detail.payments.map((p) => [p.amount, p.account])).toEqual([
      [2000, 'cash'],
      [1000, 'instapay'],
    ]);
    expect(detail.payments.every((p) => p.attachments.length === 0)).toBe(true);
    expect(detail.credit).toBe(0);
  });

  it('walkFifo is pure integer arithmetic and never over-pays an invoice', () => {
    const walked = walkFifo(
      [
        { documentId: 'a', docNo: 'IN-000012', docDate: T0, total: 2500 },
        { documentId: 'b', docNo: 'IN-000014', docDate: T0 + DAY, total: 2500 },
      ],
      99999, // pool far larger than the invoices — the surplus is a credit, not a
    ); //     bigger "paid" on the last invoice.
    expect(walked.map((s) => s.paid)).toEqual([2500, 2500]);
    expect(walked.every((s) => Number.isInteger(s.paid) && Number.isInteger(s.remaining))).toBe(
      true,
    );
  });
});

describe('TC-5.5 — aging, on an INJECTED clock', () => {
  it("reports the age of the OLDEST UNPAID invoice, in whole days", () => {
    const ahmed = addSupplier('Ahmed');
    const at45 = T0 - 45 * DAY;
    purchase(ahmed, 4000, [], { docDate: at45 });
    purchase(ahmed, 1000, [], { docDate: T0 - 3 * DAY });

    // "now" is T0, injected — never Date.now(), which would make this test flake
    // and would make it flake FIRST, before anything else in the suite.
    const [row] = debtsAt(T0).list();

    expect(row.ageDays).toBe(45);
    expect(row.oldestUnpaidAt).toBe(at45);
  });

  it('ages from the oldest invoice the money has NOT reached, not the oldest invoice', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 4000, [], { docDate: T0 - 45 * DAY }); // FIFO settles this one
    purchase(ahmed, 1000, [], { docDate: T0 - 10 * DAY });
    pay(ahmed, 4000);

    // The 45-day-old invoice is paid. The debt on the books is 10 days old, and
    // saying "45" would have the owner apologising for a debt he already settled.
    const [row] = debtsAt(T0).list();
    expect(row.owed).toBe(1000);
    expect(row.ageDays).toBe(10);
  });

  it('a debt raised today is 0 days old, never negative', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 4000, [], { docDate: T0 + 2 * DAY }); // future-dated, even
    expect(debtsAt(T0).list()[0].ageDays).toBe(0);
  });
});

describe('TC-5.6 — on-account payment: the credit absorbs the next invoice', () => {
  it('paying 5000 with no invoices gives a 5000 credit, which a later 3000 invoice eats into', () => {
    const ahmed = addSupplier('Ahmed');

    pay(ahmed, 5000); // a deposit — nothing invoiced yet

    expect(debts.owed(ahmed)).toBe(-5000); // he owes YOU 5000
    expect(debts.detail(ahmed).credit).toBe(5000);
    expect(debts.list()).toEqual([]); // a credit is not a debt

    purchase(ahmed, 3000, [], { docDate: T0 + 5 * DAY });

    // No allocation logic ran. The credit absorbed the invoice because the debt
    // is a subtraction, and there was nothing else it could have done.
    expect(debts.owed(ahmed)).toBe(-2000);
    expect(debts.settlements(ahmed)[0]).toMatchObject({ paid: 3000, status: 'settled' });
    expect(debts.list()).toEqual([]);
  });

  it('TC-2.5: overpaying an existing debt turns it into a credit — no throw, no clamp', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 2500);

    expect(() => pay(ahmed, 4000, { at: T0 + DAY })).not.toThrow();

    expect(debts.owed(ahmed)).toBe(-1500); // NOT clamped to 0
    expect(debts.detail(ahmed).credit).toBe(1500);
    expect(debts.payables().total).toBe(0);
  });
});

describe('TC-5.7 — AP and AR are two books, and are never auto-netted', () => {
  it('a supplier who is also a customer still shows the full 6000 payable', () => {
    const ahmed = addSupplier('Ahmed', '0100');
    purchase(ahmed, 6000);

    // The same man, on the other side of the shop: same name, same phone, a
    // different party in a different book.
    const customers = createCustomerRepository(db, () => T0);
    const ahmedCustomer = customers.create({ name: 'Ahmed', phone: '0100' });
    docs.create({
      kind: 'outgoing',
      status: 'posted',
      partyId: ahmedCustomer.id,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 10000 }],
      payments: [{ amount: 10000, account: 'cash' }],
    });

    // Netting him to -4000 would be silently inventing an offset the two of them
    // never agreed to — and an argument nobody could later reconstruct.
    expect(debts.owed(ahmed)).toBe(6000);
    expect(debts.list()[0]).toMatchObject({ name: 'Ahmed', owed: 6000 });
    expect(debts.payables().total).toBe(6000);
  });
});

describe('payables breakdown', () => {
  it('is structured so expenses can be added later without a consumer rewrite', () => {
    const ahmed = addSupplier('Ahmed');
    purchase(ahmed, 5500);

    // Epic 3 fills in `expenses` (rent is debt too); today it is honestly 0.
    expect(debts.payables()).toEqual({ suppliers: 5500, expenses: 0, total: 5500 });
  });
});
