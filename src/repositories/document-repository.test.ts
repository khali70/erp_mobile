import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels } from '@/db/sentinels';
import * as schema from '@/db/schema';
import {
  createDocumentRepository,
  InvalidPaymentError,
  NegativeStockError,
  type CreateDocumentInput,
  type DocumentRepository,
} from './document-repository';
import { createSupplierRepository } from './supplier-repository';
import { createDebtRepository } from './debt-repository';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()

let db: TestDb;
let repo: DocumentRepository;

beforeEach(() => {
  db = makeTestDb();
  repo = createDocumentRepository(db);
});

const incoming = (itemId: string, qty: number, unitPrice = 0): CreateDocumentInput => ({
  kind: 'incoming',
  status: 'posted',
  lines: [{ itemId, qty, unitPrice }],
});
const outgoing = (itemId: string, qty: number, unitPrice = 0): CreateDocumentInput => ({
  kind: 'outgoing',
  status: 'posted',
  lines: [{ itemId, qty, unitPrice }],
});

describe('documentRepository — posting into real SQL', () => {
  it('posting incoming (A,10) sets on-hand 10; then outgoing (A,3) → 7', () => {
    repo.create(incoming('A', 10));
    expect(repo.onHand('A')).toBe(10);
    repo.create(outgoing('A', 3));
    expect(repo.onHand('A')).toBe(7);
  });

  it('a draft has no stock effect; posting it applies the effect exactly once', () => {
    const id = repo.create({ kind: 'incoming', lines: [{ itemId: 'A', qty: 5 }] }); // default draft
    expect(repo.onHand('A')).toBe(0);
    repo.post(id);
    expect(repo.onHand('A')).toBe(5);
    repo.post(id); // idempotent — no double count
    expect(repo.onHand('A')).toBe(5);
  });

  it('blocks an overdrawing outgoing post (allowNegative=false) and leaves stock intact', () => {
    repo.create(incoming('A', 5));
    const draftId = repo.create({ kind: 'outgoing', lines: [{ itemId: 'A', qty: 8 }] });
    expect(() => repo.post(draftId)).toThrow(NegativeStockError);
    expect(repo.onHand('A')).toBe(5);
  });

  it('allows the same overdraw when allowNegative=true (on-hand goes negative)', () => {
    repo.create(incoming('A', 5));
    const draftId = repo.create({ kind: 'outgoing', lines: [{ itemId: 'A', qty: 8 }] });
    repo.post(draftId, { allowNegative: true });
    expect(repo.onHand('A')).toBe(-3);
  });

  it('unpost reverts a posted doc; on-hand re-derives without it', () => {
    repo.create(incoming('A', 10));
    const outId = repo.create(outgoing('A', 4));
    expect(repo.onHand('A')).toBe(6);
    repo.unpost(outId);
    expect(repo.onHand('A')).toBe(10);
  });

  it('remove (soft-delete) drops the doc stock effect', () => {
    const inId = repo.create(incoming('A', 10));
    expect(repo.onHand('A')).toBe(10);
    repo.remove(inId);
    expect(repo.onHand('A')).toBe(0);
    expect(repo.list()).toHaveLength(0); // hidden from live list
  });

  it('editing via unpost→repost does not double count', () => {
    const inId = repo.create(incoming('A', 10));
    repo.unpost(inId);
    repo.post(inId);
    expect(repo.onHand('A')).toBe(10);
  });

  it('assigns monotonic per-kind doc numbers', () => {
    const a = repo.create(incoming('A', 1));
    const b = repo.create(incoming('A', 1));
    const c = repo.create(outgoing('A', 1));
    expect(repo.getWithLines(a)!.docNo).toBe('IN-000001');
    expect(repo.getWithLines(b)!.docNo).toBe('IN-000002');
    expect(repo.getWithLines(c)!.docNo).toBe('OUT-000001');
  });

  it('caches total_amount from line qty × unit price', () => {
    const id = repo.create(incoming('A', 2, 350)); // 2 × 3.50
    expect(repo.getWithLines(id)!.totalAmount).toBe(700);
  });

  // A haggled sale must record BOTH what it sold for and what it listed at. The
  // gap is the discount, and it cannot be reconstructed later — items.sale_price
  // moves, and the ledger is immutable. See docs/plan/features/02.
  it('records the negotiated unit price and the list price it was sold against', () => {
    repo.create(incoming('A', 5, 18000)); // stock to sell from
    const id = repo.create({
      kind: 'outgoing',
      status: 'posted',
      lines: [{ itemId: 'A', qty: 1, unitPrice: 20000, listPrice: 25000 }], // sold 200, lists 250
    });
    const [line] = repo.getWithLines(id)!.lines;
    expect(line.unitPrice).toBe(20000);
    expect(line.listPrice).toBe(25000);
    // Revenue follows the price actually charged, not the list price.
    expect(repo.getWithLines(id)!.totalAmount).toBe(20000);
  });

  it('leaves listPrice null when none is supplied (purchases, legacy lines)', () => {
    const id = repo.create(incoming('A', 2, 350));
    expect(repo.getWithLines(id)!.lines[0].listPrice).toBeNull();
  });

  it('list filters by kind and status', () => {
    repo.create(incoming('A', 1));
    repo.create(outgoing('A', 0.0)); // zero-qty outgoing, still a posted doc
    repo.create({ kind: 'incoming', lines: [{ itemId: 'B', qty: 1 }] }); // draft
    expect(repo.list({ kind: 'incoming' })).toHaveLength(2);
    expect(repo.list({ status: 'posted' })).toHaveLength(2);
    expect(repo.list({ status: 'draft' })).toHaveLength(1);
  });
});

// TC-2.2 — THE trap of this feature. expo-sqlite's sync driver cannot nest
// transactions, so the payment insert must run INSIDE create()'s existing
// db.transaction(), not open its own. That constraint is also the guarantee:
// document, lines, stock and cash book commit together or not at all.
describe('documentRepository — payment atomicity (TC-2.2)', () => {
  let suppliers: ReturnType<typeof createSupplierRepository>;
  let debts: ReturnType<typeof createDebtRepository>;
  let ahmed: string;

  beforeEach(() => {
    suppliers = createSupplierRepository(db, () => T0);
    debts = createDebtRepository(db);
    seedSentinels(db, T0);
    ahmed = suppliers.create({ name: 'Ahmed' }).id;
  });

  const purchaseWithPayment = (amount: number): string =>
    repo.create({
      kind: 'incoming',
      status: 'posted',
      partyId: ahmed,
      docDate: T0,
      lines: [{ itemId: 'A', qty: 3, unitPrice: 2000 }], // total 6000
      payments: [{ amount, account: 'cash' }],
    });

  const rowCounts = () => ({
    docs: db.select().from(schema.documents).all().length,
    lines: db.select().from(schema.documentLines).all().length,
    txs: db.select().from(schema.transactions).all().length,
  });

  it('a FAILING payment insert rolls the document AND its lines back', () => {
    // A negative amount violates the transactions CHECK constraint (and the
    // repository guard). Either way it throws from inside the same transaction
    // that wrote the document.
    expect(() => purchaseWithPayment(-500)).toThrow();

    // No orphan invoice carrying a phantom debt — the entire write is gone.
    expect(rowCounts()).toEqual({ docs: 0, lines: 0, txs: 0 });
    expect(debts.owed(ahmed)).toBe(0);
    expect(repo.onHand('A')).toBe(0); // and the stock it would have added
  });

  it('a payment exceeding the document total rolls everything back too', () => {
    expect(() => purchaseWithPayment(9999)).toThrow(InvalidPaymentError);
    expect(rowCounts()).toEqual({ docs: 0, lines: 0, txs: 0 });
  });

  it('the happy path commits document, lines, stock and cash book together', () => {
    purchaseWithPayment(2000);

    expect(rowCounts()).toEqual({ docs: 1, lines: 1, txs: 1 });
    expect(repo.onHand('A')).toBe(3);
    expect(debts.owed(ahmed)).toBe(4000);
  });

  it('rejects a payment on a DRAFT — a draft is not an obligation and settles nothing', () => {
    expect(() =>
      repo.create({
        kind: 'incoming',
        status: 'draft',
        partyId: ahmed,
        docDate: T0,
        lines: [{ itemId: 'A', qty: 1, unitPrice: 2000 }],
        payments: [{ amount: 2000, account: 'cash' }],
      }),
    ).toThrow(InvalidPaymentError);
    expect(rowCounts()).toEqual({ docs: 0, lines: 0, txs: 0 });
  });

  it('a sale takes money IN against the document itself (+1, ref_kind=sale)', () => {
    repo.create(incoming('A', 10, 1000)); // stock to sell
    const saleId = repo.create({
      kind: 'outgoing',
      status: 'posted',
      partyId: 'walk-in-customer',
      docDate: T0,
      lines: [{ itemId: 'A', qty: 2, unitPrice: 5000 }], // total 10000
      payments: [{ amount: 10000, account: 'cash' }],
    });

    const tx = db.select().from(schema.transactions).all();
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({
      direction: 1, // money IN
      amount: 10000,
      refKind: 'sale',
      refId: saleId, // points at the DOCUMENT, not a party
      account: 'cash',
    });
  });
});
