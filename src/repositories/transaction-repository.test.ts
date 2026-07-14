import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { createDocumentRepository } from './document-repository';
import {
  createTransactionRepository,
  InvalidTransactionError,
  type CreateTransactionInput,
} from './transaction-repository';
import { createSupplierRepository } from './supplier-repository';
import type { AttachmentMeta } from './document-repository';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()
const DAY = 86_400_000;

let db: TestDb;
let txs: ReturnType<typeof createTransactionRepository>;
let docs: ReturnType<typeof createDocumentRepository>;
let suppliers: ReturnType<typeof createSupplierRepository>;

beforeEach(() => {
  db = makeTestDb();
  txs = createTransactionRepository(db, () => T0);
  docs = createDocumentRepository(db);
  suppliers = createSupplierRepository(db, () => T0);
  seedSentinels(db, T0);
});

const proof = (name: string): AttachmentMeta => ({
  id: `att-${name}`,
  name: `${name}.jpg`,
  mime: 'image/jpeg',
  size: 1024,
});

const out = (over: Partial<CreateTransactionInput> = {}): CreateTransactionInput => ({
  direction: -1,
  amount: 1000,
  occurredAt: T0,
  account: 'cash',
  ...over,
});

describe('the cash book — money moves, in one pocket or the other', () => {
  it('TC-4.1: an InstaPay sale moves ONLY the InstaPay pocket, and carries its screenshot', () => {
    const id = txs.create({
      direction: 1,
      amount: 10000,
      occurredAt: T0,
      account: 'instapay',
      refKind: 'sale',
      refId: 'doc-1',
      attachments: [proof('screenshot')],
    });

    const [row] = txs.listByRef('sale', 'doc-1');
    expect(row.id).toBe(id);
    expect(row).toMatchObject({ direction: 1, amount: 10000, account: 'instapay' });
    expect(JSON.parse(row.attachments!)).toEqual([proof('screenshot')]);

    expect(txs.cashByAccount('instapay')).toBe(10000);
    // ← the assertion that proves the two pockets are genuinely separate. The
    // drawer has notes you can count; InstaPay has a balance in an app. If one
    // leaked into the other, neither could ever be reconciled.
    expect(txs.cashByAccount('cash')).toBe(0);
  });

  it('TC-4.2: proof of MONEY lives on each payment; proof of GOODS stays on the document', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;

    // A 30000 purchase whose paper invoice (proof of GOODS) is attached to the
    // document, paid in three installments across two pockets.
    const docId = docs.create({
      kind: 'incoming',
      status: 'posted',
      partyId: ahmed,
      docDate: T0,
      attachments: [proof('paper-invoice')],
      lines: [{ itemId: 'X', qty: 1, unitPrice: 30000 }],
      payments: [{ amount: 10000, account: 'cash' }],
    });

    // ...then two InstaPay installments, later, each with its OWN screenshot.
    txs.create({
      direction: -1,
      amount: 10000,
      occurredAt: T0 + 7 * DAY,
      account: 'instapay',
      refKind: 'supplier',
      refId: ahmed,
      attachments: [proof('A')],
    });
    txs.create({
      direction: -1,
      amount: 10000,
      occurredAt: T0 + 14 * DAY,
      account: 'instapay',
      refKind: 'supplier',
      refId: ahmed,
      attachments: [proof('B')],
    });

    const rows = txs.listByRef('supplier', ahmed);
    expect(rows).toHaveLength(3);

    // Three payments, three proofs, each attached to the payment it proves.
    // THIS is the case that makes a single `paid_amount` column impossible: one
    // number cannot say which screenshot belongs to which installment.
    expect(rows[0].attachments).toBeNull(); // cash needs no proof
    expect(JSON.parse(rows[1].attachments!)).toEqual([proof('A')]);
    expect(JSON.parse(rows[2].attachments!)).toEqual([proof('B')]);

    // The document's own attachments are untouched by any of it.
    expect(docs.getWithLines(docId)!.attachments).toEqual([proof('paper-invoice')]);
  });

  it('TC-9.5: walk-in money is FULLY visible in the cash book — cash hides nothing', () => {
    docs.create({
      kind: 'incoming',
      status: 'posted',
      partyId: WALKIN_SUPPLIER_ID,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 6000 }],
      payments: [{ amount: 6000, account: 'cash' }],
    });

    // Debt hides the sentinel (TC-9.3). The cash book does NOT: the money
    // genuinely left the drawer, and a ledger with a hole in it is worse than
    // no ledger — the day its figure stops matching the drawer is the day the
    // owner stops trusting the app.
    const ledger = txs.listForCashBook();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].refId).toBe(WALKIN_SUPPLIER_ID);
    expect(txs.cashByAccount('cash')).toBe(-6000);
  });

  it('TC-7.2: a transfer between pockets nets to zero total cash', () => {
    txs.createMany([
      { direction: -1, amount: 5000, occurredAt: T0, account: 'cash', refKind: 'transfer' },
      { direction: 1, amount: 5000, occurredAt: T0, account: 'instapay', refKind: 'transfer' },
    ]);

    expect(txs.cashByAccount('cash')).toBe(-5000);
    expect(txs.cashByAccount('instapay')).toBe(5000);
    // A transfer is not income and not an expense — it is the same money in a
    // different pocket. Get this wrong and every transfer looks like a loss.
    expect(txs.cashByAccount('cash') + txs.cashByAccount('instapay')).toBe(0);
  });

  it('TC-7.3: reconciliation — Σ(direction × amount) per account IS that account balance', () => {
    const rows: CreateTransactionInput[] = [
      { direction: 1, amount: 10000, occurredAt: T0, account: 'cash', refKind: 'sale' },
      { direction: -1, amount: 4000, occurredAt: T0 + 1, account: 'cash', refKind: 'supplier' },
      { direction: -1, amount: 2000, occurredAt: T0 + 2, account: 'cash', refKind: 'owner' },
      { direction: 1, amount: 7000, occurredAt: T0 + 3, account: 'instapay', refKind: 'sale' },
      { direction: -1, amount: 1500, occurredAt: T0 + 4, account: 'instapay', refKind: 'expense' },
    ];
    txs.createMany(rows);

    const expected = (account: 'cash' | 'instapay') =>
      rows
        .filter((r) => r.account === account)
        .reduce((sum, r) => sum + r.direction * r.amount, 0);

    expect(txs.cashByAccount('cash')).toBe(expected('cash')); // 10000 − 4000 − 2000 = 4000
    expect(txs.cashByAccount('instapay')).toBe(expected('instapay')); // 7000 − 1500 = 5500
  });

  it('TC-7.4: a soft-deleted transaction vanishes from every figure', () => {
    const id = txs.create(out({ direction: 1, amount: 10000, account: 'cash', refKind: 'sale', refId: 'd1' }));
    expect(txs.cashByAccount('cash')).toBe(10000);

    txs.archive(id);

    expect(txs.cashByAccount('cash')).toBe(0);
    expect(txs.sumByRef('sale', 'd1')).toBe(0);
    expect(txs.listByRef('sale', 'd1')).toHaveLength(0);
    expect(txs.listForCashBook()).toHaveLength(0);
  });

  it('orders the cash book by when the money MOVED, most recent first', () => {
    txs.create(out({ amount: 100, occurredAt: T0 + 2 * DAY, note: 'middle' }));
    txs.create(out({ amount: 200, occurredAt: T0, note: 'oldest' }));
    txs.create(out({ amount: 300, occurredAt: T0 + 9 * DAY, note: 'newest' }));

    expect(txs.listForCashBook().map((r) => r.note)).toEqual(['newest', 'middle', 'oldest']);
  });
});

describe('the sign invariant — it lives in `direction`, never in `amount`', () => {
  it('rejects a negative or zero amount', () => {
    // A negative amount would be double-counted against `direction` in every
    // SUM, silently inverting half the cash book.
    expect(() => txs.create(out({ amount: -1000 }))).toThrow(InvalidTransactionError);
    expect(() => txs.create(out({ amount: 0 }))).toThrow(InvalidTransactionError);
  });

  it('rejects a non-integer amount — money is minor units, never a float', () => {
    expect(() => txs.create(out({ amount: 10.5 }))).toThrow(InvalidTransactionError);
  });

  it('rejects a direction that is not exactly +1 or -1', () => {
    expect(() => txs.create(out({ direction: 0 as 1 }))).toThrow(InvalidTransactionError);
  });

  it('the SQL CHECK constraints hold the line even on a raw write', () => {
    // Belt and braces: the guard above is JS. This is what actually rolls back a
    // document when its payment insert fails (TC-2.2).
    expect(() =>
      db.run(
        `INSERT INTO transactions (id, created_at, updated_at, direction, amount, occurred_at, account)
         VALUES ('bad', ${T0}, ${T0}, -1, -500, ${T0}, 'cash')`,
      ),
    ).toThrow();
  });
});

describe('sumByRef', () => {
  it('sums only live rows pointing at that exact ref', () => {
    txs.create(out({ amount: 2000, refKind: 'supplier', refId: 'ahmed' }));
    txs.create(out({ amount: 3000, refKind: 'supplier', refId: 'ahmed' }));
    txs.create(out({ amount: 9999, refKind: 'supplier', refId: 'mahmoud' }));
    txs.create(out({ amount: 8888, refKind: 'expense', refId: 'ahmed' })); // different kind

    expect(txs.sumByRef('supplier', 'ahmed')).toBe(5000);
    expect(txs.sumByRef('supplier', 'nobody')).toBe(0);
  });
});
