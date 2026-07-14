import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_CUSTOMER_ID, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import {
  createSupplierRepository,
  SupplierHasDebtError,
  SystemPartyError,
} from './supplier-repository';
import { createCustomerRepository } from './customer-repository';
import { createDocumentRepository } from './document-repository';
import { createDebtRepository } from './debt-repository';
import { createTransactionRepository } from './transaction-repository';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()

let db: TestDb;
let suppliers: ReturnType<typeof createSupplierRepository>;
let customers: ReturnType<typeof createCustomerRepository>;
let docs: ReturnType<typeof createDocumentRepository>;
let debts: ReturnType<typeof createDebtRepository>;
let txs: ReturnType<typeof createTransactionRepository>;

beforeEach(() => {
  db = makeTestDb();
  suppliers = createSupplierRepository(db, () => T0);
  customers = createCustomerRepository(db, () => T0);
  docs = createDocumentRepository(db);
  debts = createDebtRepository(db, () => T0);
  txs = createTransactionRepository(db, () => T0);
  seedSentinels(db, T0);
});

/** A posted purchase from `partyId`, optionally part-paid at the counter. */
const purchase = (
  partyId: string,
  total: number,
  payments?: { amount: number; account: 'cash' | 'instapay' }[],
) =>
  docs.create({
    kind: 'incoming',
    status: 'posted',
    partyId,
    docDate: T0,
    lines: [{ itemId: 'X', qty: 1, unitPrice: total }],
    payments,
  });

describe('TC-9.2 — the sentinel is hidden from the party lists', () => {
  it('supplierRepository.list() excludes it', () => {
    suppliers.create({ name: 'Ahmed' });
    const listed = suppliers.list();

    // The owner must never see "نقدي (بدون مورد)" sitting in his supplier list
    // as if it were a real person he could tap, call, or pay.
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Ahmed');
    expect(listed.some((s) => s.id === WALKIN_SUPPLIER_ID)).toBe(false);
  });

  it('customerRepository.list() excludes it', () => {
    customers.create({ name: 'Sayed' });
    const listed = customers.list();
    expect(listed).toHaveLength(1);
    expect(listed.some((c) => c.id === WALKIN_CUSTOMER_ID)).toBe(false);
  });

  it('but get(id) still resolves it — a walk-in document must find its party name', () => {
    expect(suppliers.get(WALKIN_SUPPLIER_ID)).toMatchObject({ isSystem: 1 });
    expect(customers.get(WALKIN_CUSTOMER_ID)).toMatchObject({ isSystem: 1 });
  });
});

describe('TC-9.4 — the sentinel is UNDELETABLE, UNARCHIVABLE, UNEDITABLE', () => {
  // This is the catastrophic one. Archive the sentinel and every walk-in
  // document in history orphans: its party_id points at a soft-deleted row, and
  // every join silently drops those documents from every report. No crash, no
  // error — just a permanent, invisible hole in the shop's history.
  it('archive() on a sentinel supplier is REJECTED', () => {
    expect(() => suppliers.archive(WALKIN_SUPPLIER_ID)).toThrow(SystemPartyError);
    expect(suppliers.get(WALKIN_SUPPLIER_ID)!.deletedAt).toBeNull();
  });

  it('update() on a sentinel supplier is REJECTED', () => {
    expect(() =>
      suppliers.update({ id: WALKIN_SUPPLIER_ID, name: 'hacked', phone: '123' }),
    ).toThrow(SystemPartyError);
    expect(suppliers.get(WALKIN_SUPPLIER_ID)!.name).not.toBe('hacked');
  });

  it('archive() and update() on a sentinel customer are REJECTED', () => {
    expect(() => customers.archive(WALKIN_CUSTOMER_ID)).toThrow(SystemPartyError);
    expect(() =>
      customers.update({ id: WALKIN_CUSTOMER_ID, name: 'hacked', phone: null }),
    ).toThrow(SystemPartyError);
    expect(customers.get(WALKIN_CUSTOMER_ID)!.deletedAt).toBeNull();
  });

  it('still allows editing and archiving a REAL party', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' });
    expect(() => suppliers.update({ id: ahmed.id, name: 'Ahmed Ali', phone: '0100' })).not.toThrow();
    expect(suppliers.get(ahmed.id)!.name).toBe('Ahmed Ali');

    suppliers.archive(ahmed.id);
    expect(suppliers.list()).toHaveLength(0);
  });
});

describe('TC-9.7 — the sentinel is not a real party in any COUNT', () => {
  it('a shop with zero real suppliers reads as EMPTY, not as "1 supplier"', () => {
    expect(suppliers.count()).toBe(0);
    expect(customers.count()).toBe(0);

    suppliers.create({ name: 'Ahmed' });
    expect(suppliers.count()).toBe(1);
  });
});

describe('archiving a supplier the shop still OWES', () => {
  // The quiet one. `list()` and every debt figure filter `deleted_at IS NULL`,
  // so archiving a supplier you owe 5,000 does not warn, does not error and
  // does not leave a trace — it simply removes 5,000 from total payables. The
  // owner's KPI drops and nothing on any screen can tell him why.
  it('is REJECTED while his derived debt is positive', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    purchase(ahmed, 5000);
    expect(debts.payables().total).toBe(5000);

    expect(() => suppliers.archive(ahmed)).toThrow(SupplierHasDebtError);

    // Nothing moved: he is still in the list, and the debt is still on the books.
    expect(suppliers.get(ahmed)!.deletedAt).toBeNull();
    expect(suppliers.list()).toHaveLength(1);
    expect(debts.payables().total).toBe(5000);
  });

  it('carries the amount owed, so the UI can say WHICH debt blocked it', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    purchase(ahmed, 6000, [{ amount: 2000, account: 'cash' }]);

    expect(() => suppliers.archive(ahmed)).toThrow(
      expect.objectContaining({ name: 'SupplierHasDebtError', owed: 4000 }),
    );
  });

  it('is ALLOWED once he is paid off — a settled supplier is just a supplier', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    purchase(ahmed, 5000, [{ amount: 5000, account: 'cash' }]);

    expect(debts.owed(ahmed)).toBe(0);
    expect(() => suppliers.archive(ahmed)).not.toThrow();
    expect(suppliers.list()).toHaveLength(0);
  });

  it('is ALLOWED when he holds a CREDIT — a receivable is not a payable', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    purchase(ahmed, 2500);
    // Overpay him on account, from the debts screen: 4000 against 2500 owed.
    txs.create({
      direction: -1,
      amount: 4000,
      occurredAt: T0,
      account: 'cash',
      refKind: 'supplier',
      refId: ahmed,
    });

    expect(debts.owed(ahmed)).toBe(-1500);
    // Only a POSITIVE debt blocks. Guarding a credit would strand him forever:
    // there is no screen that can pay a negative balance back up to zero.
    expect(() => suppliers.archive(ahmed)).not.toThrow();
  });

  it('a DRAFT purchase is not an obligation and does not block the archive', () => {
    const ahmed = suppliers.create({ name: 'Ahmed' }).id;
    docs.create({
      kind: 'incoming',
      status: 'draft', // nothing was taken from anyone
      partyId: ahmed,
      docDate: T0,
      lines: [{ itemId: 'X', qty: 1, unitPrice: 5000 }],
    });

    expect(() => suppliers.archive(ahmed)).not.toThrow();
  });
});

describe('create()', () => {
  it('never mints a sentinel — only the seed may do that', () => {
    const created = suppliers.create({ name: 'Ahmed' });
    expect(created.isSystem).toBe(0);
    expect(() => suppliers.archive(created.id)).not.toThrow();
  });
});
