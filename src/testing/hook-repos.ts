// THE REPOSITORIES A HOOK TEST TALKS TO — real ones, over a real database.
//
// The hooks import their repositories from the `.client.ts` singletons, which
// bind to expo-sqlite and cannot exist in a test process. Each hook test
// `jest.mock`s those singleton modules and hands back the repos below instead:
// the SAME factories the app builds, bound to an in-memory better-sqlite3 db
// carrying the app's own DDL (src/db/testing/test-db.ts).
//
// Why not mock the repositories themselves? Because the constraints ARE the
// specification. `transactions.amount > 0` is a CHECK in SQL — a purchase paid
// in nothing must write NO row, and a jest.fn() would happily record a call to
// `create({ amount: 0 })` and call it a pass. The bug this suite exists to catch
// (Arabic-Indic digits parsing to 0) is exactly a zero-amount bug, so the thing
// that rejects zeroes has to be present.
//
// The clock is fixed at T0 for every repo — never Date.now() (house rule).
import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import { seedSentinels } from '@/db/sentinels';
import { createDocumentRepository, type DocumentRepository } from '@/repositories/document-repository';
import {
  createTransactionRepository,
  type TransactionRepository,
} from '@/repositories/transaction-repository';
import { createItemRepository, type ItemRepository } from '@/repositories/item-repository';
import { createSupplierRepository } from '@/repositories/supplier-repository';
import { createCustomerRepository } from '@/repositories/customer-repository';
import { createDebtRepository } from '@/repositories/debt-repository';
import { createTagRepository } from '@/repositories/tag-repository';

/** Fixed clock. Every repo, every row, every test. */
export const T0 = 1_760_000_000_000;

export interface HookRepoHarness {
  db: TestDb;
  documents: DocumentRepository;
  transactions: TransactionRepository;
  items: ItemRepository;
  suppliers: ReturnType<typeof createSupplierRepository>;
  customers: ReturnType<typeof createCustomerRepository>;
  debts: ReturnType<typeof createDebtRepository>;
  tags: ReturnType<typeof createTagRepository>;
}

let current: HookRepoHarness | null = null;

/** Fresh in-memory db + repos, sentinels seeded. One per test. */
export function resetHookRepos(): HookRepoHarness {
  const db = makeTestDb();
  seedSentinels(db, T0);
  current = {
    db,
    documents: createDocumentRepository(db),
    transactions: createTransactionRepository(db, () => T0),
    items: createItemRepository(db),
    suppliers: createSupplierRepository(db, () => T0),
    customers: createCustomerRepository(db, () => T0),
    debts: createDebtRepository(db, () => T0),
    tags: createTagRepository(db),
  };
  return current;
}

export function hookRepos(): HookRepoHarness {
  return current ?? resetHookRepos();
}

/**
 * Live handles for the `jest.mock` factories. Every property is a GETTER, so a
 * mocked `.client` module keeps pointing at the CURRENT db after `resetHookRepos()`
 * swaps it — the module factory runs once, the getter runs on every access.
 */
export const repos = {
  get db(): TestDb {
    return hookRepos().db;
  },
  get documents(): DocumentRepository {
    return hookRepos().documents;
  },
  get transactions(): TransactionRepository {
    return hookRepos().transactions;
  },
  get items(): ItemRepository {
    return hookRepos().items;
  },
  get suppliers(): HookRepoHarness['suppliers'] {
    return hookRepos().suppliers;
  },
  get customers(): HookRepoHarness['customers'] {
    return hookRepos().customers;
  },
  get debts(): HookRepoHarness['debts'] {
    return hookRepos().debts;
  },
  get tags(): HookRepoHarness['tags'] {
    return hookRepos().tags;
  },
};
