import * as schema from './schema';
import type { SentinelDb } from './sentinels';
import type { CreateDocumentInput } from '@/repositories/document-repository';

// THE DEMO CATALOG — placeholder items + ledger-backed opening stock.
//
// This module is PURE by design: it imports NO `./client` and NO `@/i18n`, so it
// can run off-device (jest node suite, over better-sqlite3) with its collaborators
// injected. `seed.ts` is the thin on-device wrapper that binds the real client
// singletons and the real `__DEV__` gate. Keeping the core injectable is what lets
// a test prove the gate: `seedDemoData(..., enabled=false)` inserts nothing.

interface SeedSpec {
  nameKey: string;
  category: string;
  unit: string;
  priceMajor: number;
  /**
   * What the shop PAID for it. Deliberately per-item.
   *
   * This used to be `price * COST_RATIO` with a single 0.6 for every item — so
   * every item carried an identical 40% margin, and the month's margin KPI
   * computed 40٪ and could never compute anything else. A number that looks
   * derived but is structurally incapable of moving is worse than an obviously
   * fake one: it survives review, because it looks like it is working.
   *
   * Real margins are uneven — a jacket is not a t-shirt is not a pair of shoes.
   */
  costMajor: number;
  qty: number;
  lowStockThreshold: number;
}

// prettier-ignore
export const SPECS: readonly SeedSpec[] = [
  { nameKey: 'item1', category: 'tshirts',     unit: 'piece', priceMajor: 250,  costMajor: 160, qty: 24, lowStockThreshold: 10 }, // 36%
  { nameKey: 'item2', category: 'jackets',     unit: 'piece', priceMajor: 650,  costMajor: 455, qty: 6,  lowStockThreshold: 8 },  // 30%
  { nameKey: 'item3', category: 'shoes',       unit: 'pair',  priceMajor: 1200, costMajor: 780, qty: 0,  lowStockThreshold: 4 },  // 35%
  { nameKey: 'item4', category: 'pants',       unit: 'piece', priceMajor: 550,  costMajor: 330, qty: 18, lowStockThreshold: 6 },  // 40%
  { nameKey: 'item5', category: 'shirts',      unit: 'piece', priceMajor: 480,  costMajor: 336, qty: 3,  lowStockThreshold: 5 },  // 30%
  { nameKey: 'item6', category: 'accessories', unit: 'piece', priceMajor: 180,  costMajor: 99,  qty: 40, lowStockThreshold: 10 }, // 45%
];

export const MINOR_PER_MAJOR = 100;

/** The collaborators the demo seed needs, injected so the core stays pure. */
export interface DemoSeedDeps {
  /** Guard: how many items already exist (the "if empty" in the name). */
  itemCount(): number;
  /** Create a POSTED incoming document — the ledger-backed opening balance. */
  createDocument(input: CreateDocumentInput): void;
  /** i18n resolver (`inventory.demo.*`); no Arabic copy lives in this module. */
  translate(key: string): string;
  newId(): string;
  now(): number;
}

/**
 * Seed the placeholder catalog into SQLite on first run so screens render real
 * repository data (not hardcoded arrays). Names come from i18n. Prices are stored
 * as INTEGER minor units.
 *
 * Opening stock is seeded as POSTED incoming documents (ledger-backed), NOT by
 * writing `stock_levels` directly — otherwise the first real posting's recompute
 * (on-hand = Σ ledger) would wipe the seeded quantity.
 *
 * `enabled` is the DEV/PROD gate (see `seed.ts` → `DEMO_SEED_ENABLED`). When it
 * is false — every production build — this returns before touching the database.
 */
export function seedDemoData(db: SentinelDb, deps: DemoSeedDeps, enabled: boolean): void {
  if (!enabled) return; // production build: zero dummy data
  if (deps.itemCount() > 0) return;

  const ts = deps.now();
  for (const spec of SPECS) {
    const id = deps.newId();
    const costMinor = spec.costMajor * MINOR_PER_MAJOR;
    db.insert(schema.items)
      .values({
        id,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: deps.translate(`inventory.demo.${spec.nameKey}`),
        category: spec.category,
        unit: spec.unit,
        costPrice: costMinor,
        salePrice: spec.priceMajor * MINOR_PER_MAJOR,
        currency: 'EGP',
        lowStockThreshold: spec.lowStockThreshold,
      })
      .run();

    // Ledger-backed opening balance so on-hand survives future recomputes.
    if (spec.qty > 0) {
      deps.createDocument({
        kind: 'incoming',
        status: 'posted',
        note: deps.translate('inventory.demo.openingBalance'),
        lines: [{ itemId: id, qty: spec.qty, unitPrice: costMinor }],
      });
    }
  }
}
