import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { createDocumentRepository, InvalidPaymentError } from './document-repository';
import { createTransactionRepository } from './transaction-repository';
import { createSupplierRepository } from './supplier-repository';
import { createDebtRepository } from './debt-repository';
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

const addSupplier = (name: string) => suppliers.create({ name }).id;

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
