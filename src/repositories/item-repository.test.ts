import { makeTestDb } from '@/db/testing/test-db';
import {
  createItemRepository,
  DuplicateBarcodeError,
  type ItemRepository,
} from './item-repository';
import { createDocumentRepository } from './document-repository';
import { seedSentinels, WALKIN_CUSTOMER_ID } from '@/db/sentinels';
import type { TestDb } from '@/db/testing/test-db';

const T0 = 1_760_000_000_000; // fixed clock — never Date.now()

let db: TestDb;
let repo: ItemRepository;

beforeEach(() => {
  db = makeTestDb();
  repo = createItemRepository(db);
});

describe('itemRepository', () => {
  it('creates an item that appears in the list with on-hand 0', () => {
    const item = repo.create({ name: 'T-Shirt', salePrice: 12000 });
    expect(repo.list()).toHaveLength(1);
    const withStock = repo.listWithStock();
    expect(withStock[0].qtyOnHand).toBe(0);
    expect(repo.getById(item.id)?.name).toBe('T-Shirt');
  });

  it('updates fields and bumps updated_at', () => {
    const item = repo.create({ name: 'Old', salePrice: 100 });
    const before = repo.getById(item.id)!.updatedAt;
    repo.update(item.id, { name: 'New', salePrice: 250 });
    const after = repo.getById(item.id)!;
    expect(after.name).toBe('New');
    expect(after.salePrice).toBe(250);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('enforces barcode uniqueness among live items on create and update', () => {
    repo.create({ name: 'A', barcode: '123' });
    expect(() => repo.create({ name: 'B', barcode: '123' })).toThrow(DuplicateBarcodeError);
    const c = repo.create({ name: 'C', barcode: '456' });
    expect(() => repo.update(c.id, { barcode: '123' })).toThrow(DuplicateBarcodeError);
    // updating an item to its own barcode is fine
    expect(() => repo.update(c.id, { barcode: '456' })).not.toThrow();
  });

  it('frees a barcode once the holder is archived', () => {
    const a = repo.create({ name: 'A', barcode: '123' });
    repo.archive(a.id);
    expect(() => repo.create({ name: 'B', barcode: '123' })).not.toThrow();
  });

  it('archive hides the item from the list but keeps the row', () => {
    const item = repo.create({ name: 'Gone', salePrice: 1 });
    repo.archive(item.id);
    expect(repo.list()).toHaveLength(0);
    expect(repo.count()).toBe(0);
    expect(repo.getById(item.id)).not.toBeNull(); // history preserved
  });

  it('listWithStock reflects posted ledger movement', () => {
    const item = repo.create({ name: 'Widget', salePrice: 500 });
    const docs = createDocumentRepository(db);
    docs.create({ kind: 'incoming', status: 'posted', lines: [{ itemId: item.id, qty: 7 }] });
    const row = repo.listWithStock().find((r) => r.id === item.id)!;
    expect(row.qtyOnHand).toBe(7);
  });

  it('defaults to fixed pricing with no floor', () => {
    const item = repo.create({ name: 'Socks', salePrice: 5000 });
    const row = repo.listWithStock().find((r) => r.id === item.id)!;
    expect(row.pricingMode).toBe('fixed');
    expect(row.minPrice).toBeNull();
  });

  it('round-trips a negotiable item with a price floor', () => {
    const item = repo.create({
      name: 'Jacket',
      salePrice: 25000,
      costPrice: 18000,
      pricingMode: 'negotiable',
      minPrice: 19000,
    });
    const row = repo.listWithStock().find((r) => r.id === item.id)!;
    expect(row.pricingMode).toBe('negotiable');
    expect(row.minPrice).toBe(19000);
  });

  // The list price is the anchor. Posting a sale below it (a haggled price) must
  // never erode items.sale_price, or the anchor decays to whatever the last
  // customer talked the owner down to. See docs/plan/features/02 §3.
  it('a discounted sale does not mutate the item list price', () => {
    const item = repo.create({ name: 'Jacket', salePrice: 25000, costPrice: 18000 });
    const docs = createDocumentRepository(db);
    seedSentinels(db, T0);
    docs.create({ kind: 'incoming', status: 'posted', lines: [{ itemId: item.id, qty: 5 }] });
    docs.create({
      kind: 'outgoing',
      status: 'posted',
      partyId: WALKIN_CUSTOMER_ID,
      lines: [{ itemId: item.id, qty: 1, unitPrice: 20000, listPrice: 25000 }],
      // A posted sale is settled in full — there is no AR book to hold a
      // remainder. The haggling is in the PRICE, not in what went unpaid.
      payments: [{ amount: 20000, account: 'cash' }],
    });
    expect(repo.getById(item.id)!.salePrice).toBe(25000);
    expect(repo.getById(item.id)!.costPrice).toBe(18000);
  });
});
