import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels, WALKIN_CUSTOMER_ID, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { createSupplierRepository, SystemPartyError } from './supplier-repository';
import { createCustomerRepository } from './customer-repository';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()

let db: TestDb;
let suppliers: ReturnType<typeof createSupplierRepository>;
let customers: ReturnType<typeof createCustomerRepository>;

beforeEach(() => {
  db = makeTestDb();
  suppliers = createSupplierRepository(db, () => T0);
  customers = createCustomerRepository(db, () => T0);
  seedSentinels(db, T0);
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

describe('create()', () => {
  it('never mints a sentinel — only the seed may do that', () => {
    const created = suppliers.create({ name: 'Ahmed' });
    expect(created.isSystem).toBe(0);
    expect(() => suppliers.archive(created.id)).not.toThrow();
  });
});
