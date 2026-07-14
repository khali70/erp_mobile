import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_CUSTOMER_ID } from '@/db/sentinels';
import * as schema from '@/db/schema';
import {
  createDocumentRepository,
  InvalidPaymentError,
  NegativeStockError,
  type AttachmentMeta,
  type CreateDocumentInput,
  type DocumentRepository,
} from './document-repository';
import { createSupplierRepository } from './supplier-repository';
import { createDebtRepository } from './debt-repository';
import { createTransactionRepository } from './transaction-repository';

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

  // THE GUARD IS STILL THE AUTHORITY. The form now clamps quantities as they are
  // typed — but that clamp reads a SNAPSHOT of on-hand taken when the form opened,
  // and a quick-entry line only becomes a real item id inside this very call. So
  // the repository refuses on its own, and it refuses with the FACTS: which item,
  // how many were asked for, how many there are. The UI has nothing else to name.
  it('the refusal carries per-item violations (itemId / available / requested)', () => {
    repo.create(incoming('A', 5));
    repo.create(incoming('B', 1));
    const draftId = repo.create({
      kind: 'outgoing',
      lines: [
        { itemId: 'A', qty: 8 },
        { itemId: 'B', qty: 1 }, // exactly on hand — not a violation
        { itemId: 'C', qty: 2 }, // never moved — available 0
      ],
    });

    expect.assertions(4);
    try {
      repo.post(draftId);
    } catch (err) {
      const violations = (err as NegativeStockError).violations;
      expect(violations).toEqual([
        { itemId: 'A', available: 5, requested: 8 },
        { itemId: 'C', available: 0, requested: 2 },
      ]);
      expect(repo.onHand('A')).toBe(5); // nothing moved…
      expect(repo.onHand('B')).toBe(1);
      expect(repo.list({ status: 'posted' })).toHaveLength(2); // …and the sale never posted
    }
  });

  // The clamp is per ITEM, and so is the guard: two lines of the same item are
  // summed BEFORE the check. Each row here is individually within the 5 on hand.
  it('sums duplicate lines of one item before refusing (4 + 4 against 5 on hand)', () => {
    repo.create(incoming('A', 5));
    const draftId = repo.create({
      kind: 'outgoing',
      lines: [
        { itemId: 'A', qty: 4 },
        { itemId: 'A', qty: 4 },
      ],
    });

    expect(() => repo.post(draftId)).toThrow(NegativeStockError);
    try {
      repo.post(draftId);
    } catch (err) {
      expect((err as NegativeStockError).violations).toEqual([
        { itemId: 'A', available: 5, requested: 8 },
      ]);
    }
    expect(repo.onHand('A')).toBe(5);
  });

  // A PURCHASE IS NEVER STOCK-GUARDED. Buying more of something cannot overdraw
  // it — the new sale-side clamps must not have leaked into the incoming flow.
  it('an incoming doc posts freely regardless of on-hand', () => {
    const draftId = repo.create({ kind: 'incoming', lines: [{ itemId: 'A', qty: 100 }] });
    expect(() => repo.post(draftId)).not.toThrow();
    expect(repo.onHand('A')).toBe(100);
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
    seedSentinels(db, T0);
    const id = repo.create({
      kind: 'outgoing',
      status: 'posted',
      partyId: WALKIN_CUSTOMER_ID,
      lines: [{ itemId: 'A', qty: 1, unitPrice: 20000, listPrice: 25000 }], // sold 200, lists 250
      // A posted sale is settled IN FULL, always — there is no AR book to hold
      // the rest. The discount lives in the PRICE, never in an unpaid remainder.
      payments: [{ amount: 20000, account: 'cash' }],
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

// TC-3 / TC-4 — HOW THE CUSTOMER PAID.
//
// Customer debt (AR) is deprecated and unbuilt: there is NO book anywhere that
// can hold an unpaid sale. So a sale's payments MUST add up to its total, and
// the app must refuse a sale that does not — otherwise the goods walk out of the
// shop and the money exists in no record at all.
describe('documentRepository — a sale is settled in full, in one pocket or two', () => {
  let txs: ReturnType<typeof createTransactionRepository>;

  beforeEach(() => {
    txs = createTransactionRepository(db, () => T0);
    seedSentinels(db, T0);
    repo.create(incoming('A', 100, 0)); // goods on the shelf, no money moved
  });

  const sell = (
    total: number,
    payments: { amount: number; account: 'cash' | 'instapay'; attachments?: AttachmentMeta[] }[],
  ): string =>
    repo.create({
      kind: 'outgoing',
      status: 'posted',
      partyId: WALKIN_CUSTOMER_ID,
      docDate: T0,
      lines: [{ itemId: 'A', qty: 1, unitPrice: total }],
      payments,
    });

  it('TC-3.1: a cash sale of 10000 writes ONE +1 cash row against the document', () => {
    const docId = sell(10000, [{ amount: 10000, account: 'cash' }]);

    const rows = txs.listByRef('sale', docId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ direction: 1, amount: 10000, account: 'cash' });
    expect(txs.balances().cash).toBe(10000);
  });

  it('TC-3.2: REJECTS a short-paid sale — the missing money would have nowhere to live', () => {
    expect(() => sell(10000, [{ amount: 6000, account: 'cash' }])).toThrow(InvalidPaymentError);

    // And rolls back completely: no invoice, no lines, no stock movement, no
    // half-recorded money. If this ever needs to be allowed in the real shop,
    // that is the signal to un-deprecate AR — not to loosen this check.
    expect(db.select().from(schema.documents).all()).toHaveLength(1); // only the purchase
    expect(txs.listForCashBook()).toHaveLength(0);
    expect(repo.onHand('A')).toBe(100);
  });

  it('TC-3.2: REJECTS a sale recorded with no payment at all', () => {
    expect(() => sell(10000, [])).toThrow(InvalidPaymentError);
    expect(txs.listForCashBook()).toHaveLength(0);
  });

  // The two ways ROUND the invariant, as opposed to through it. Both post a sale
  // whose goods leave the shelf and whose money exists NOWHERE — the exact state
  // the rule forbids, reached by not mentioning payments at all.
  it('TC-3.2: REJECTS a posted sale whose `payments` key is OMITTED, not merely empty', () => {
    expect(() =>
      repo.create({
        kind: 'outgoing',
        status: 'posted',
        partyId: WALKIN_CUSTOMER_ID,
        docDate: T0,
        lines: [{ itemId: 'A', qty: 1, unitPrice: 10000 }],
        // no `payments` key at all — this used to skip the check entirely
      }),
    ).toThrow(InvalidPaymentError);

    expect(db.select().from(schema.documents).all()).toHaveLength(1); // only the purchase
    expect(txs.listForCashBook()).toHaveLength(0);
    expect(repo.onHand('A')).toBe(100); // the goods never left the shelf
  });

  it('TC-3.2: REJECTS post() on a DRAFT sale — it carries no money, and post takes none', () => {
    const draftId = repo.create({
      kind: 'outgoing',
      status: 'draft', // a draft holds no money; a payment on one is rejected outright
      partyId: WALKIN_CUSTOMER_ID,
      docDate: T0,
      lines: [{ itemId: 'A', qty: 1, unitPrice: 10000 }],
    });

    expect(() => repo.post(draftId)).toThrow(InvalidPaymentError);

    // Still a draft, still no stock movement, still no money. `post()` is the
    // OTHER door into 'posted', and the invariant has to stand in both.
    expect(repo.getWithLines(draftId)!.status).toBe('draft');
    expect(repo.onHand('A')).toBe(100);
    expect(txs.listForCashBook()).toHaveLength(0);
  });

  it('post() still materializes a PURCHASE draft — buying on debt is legitimate', () => {
    // The guard is about SALES only. A purchase with no money attached is a
    // purchase on debt, and the debt book is there to hold it.
    const draftId = repo.create({
      kind: 'incoming',
      status: 'draft',
      lines: [{ itemId: 'B', qty: 5, unitPrice: 1000 }],
    });

    expect(() => repo.post(draftId)).not.toThrow();
    expect(repo.onHand('B')).toBe(5);
  });

  it('TC-4.1: an InstaPay sale carries the screenshot and leaves the DRAWER untouched', () => {
    const screenshot: AttachmentMeta = {
      id: 'att-1',
      name: 'instapay.jpg',
      mime: 'image/jpeg',
      size: 2048,
    };
    const docId = sell(10000, [
      { amount: 10000, account: 'instapay', attachments: [screenshot] },
    ]);

    const [row] = txs.listByRef('sale', docId);
    expect(row).toMatchObject({ direction: 1, amount: 10000, account: 'instapay' });
    // PROOF OF MONEY lives on the payment. The document's own attachments (proof
    // of GOODS) are untouched by it.
    expect(JSON.parse(row.attachments!)).toEqual([screenshot]);
    expect(repo.getWithLines(docId)!.attachments).toEqual([]);

    expect(txs.balances().instapay).toBe(10000);
    // The assertion that proves the two pockets are genuinely separate.
    expect(txs.balances().cash).toBe(0);
  });

  it('TC-4.3: a sale split 5000 cash + 5000 InstaPay writes TWO rows on ONE document', () => {
    const docId = sell(10000, [
      { amount: 5000, account: 'cash' },
      { amount: 5000, account: 'instapay' },
    ]);

    const rows = txs.listByRef('sale', docId);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.refKind === 'sale' && r.refId === docId)).toBe(true);
    expect(rows.map((r) => r.account).sort()).toEqual(['cash', 'instapay']);

    expect(txs.balances()).toEqual({ cash: 5000, instapay: 5000, total: 10000 });
    // The settled-in-full invariant still holds: 5000 + 5000 === 10000. Read
    // SIGNED (+1 = money in), so a refund could never pose as a payment here.
    expect(txs.netByRef('sale', docId)).toBe(10000);
  });

  it('REJECTS a split that does not add up to the total', () => {
    expect(() =>
      sell(10000, [
        { amount: 5000, account: 'cash' },
        { amount: 4000, account: 'instapay' }, // 1000 short — where would it go?
      ]),
    ).toThrow(InvalidPaymentError);
    expect(txs.listForCashBook()).toHaveLength(0);
  });
});
