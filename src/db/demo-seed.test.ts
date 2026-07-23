import { makeTestDb } from './testing/test-db';
import type { SentinelDb } from './sentinels';
import { seedDemoData, SPECS, type DemoSeedDeps } from './demo-seed';
import { createItemRepository } from '@/repositories/item-repository';
import { createDocumentRepository, type DocDb } from '@/repositories/document-repository';

// The DEV/PROD gate is the whole point of this suite: a production build must
// ship ZERO dummy data, and the only thing standing between it and six demo
// items is the `enabled` flag `seed.ts` derives from `__DEV__`. So this proves
// both sides — gate off inserts nothing, gate on seeds the catalog — against a
// REAL better-sqlite3 database and the REAL repositories, not mocks.

const T0 = 1_760_000_000_000;

function harness() {
  const db = makeTestDb();
  const items = createItemRepository(db as unknown as DocDb);
  const documents = createDocumentRepository(db as unknown as DocDb);
  let n = 0;
  const deps: DemoSeedDeps = {
    itemCount: () => items.count(),
    createDocument: (input) => documents.create(input),
    translate: (key) => key,
    newId: () => `demo-${++n}`,
    now: () => T0,
  };
  return { db: db as unknown as SentinelDb, items, documents, deps };
}

describe('seedDemoData — the DEV/PROD gate', () => {
  it('inserts NOTHING under the prod gate (enabled = false)', () => {
    const { db, items, documents, deps } = harness();

    seedDemoData(db, deps, false);

    // The acceptance criterion, verified directly: no items, no opening-stock
    // documents. A production install boots against this and shows empty states.
    expect(items.count()).toBe(0);
    expect(documents.list()).toHaveLength(0);
  });

  it('seeds the full catalog under the dev gate (enabled = true)', () => {
    const { db, items, documents, deps } = harness();

    seedDemoData(db, deps, true);

    expect(items.count()).toBe(SPECS.length);
    // Opening stock is one POSTED incoming document per spec with qty > 0 —
    // ledger-backed, never a direct stock_levels write.
    const withStock = SPECS.filter((s) => s.qty > 0).length;
    expect(documents.list()).toHaveLength(withStock);
  });

  it('is idempotent — a second run over a seeded db adds nothing', () => {
    const { db, items, deps } = harness();

    seedDemoData(db, deps, true);
    seedDemoData(db, deps, true); // reboot

    expect(items.count()).toBe(SPECS.length); // the count guard held
  });
});
