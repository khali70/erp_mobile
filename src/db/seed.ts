import { db, schema } from './client';
import i18n from '@/i18n';
import { newId, now } from '@/utils/id';
import { itemRepository } from '@/repositories/item-repository';

/**
 * Dev seed: inserts a placeholder catalog into SQLite on first run so screens
 * render real repository data (not hardcoded arrays). Names come from i18n
 * (`inventory.demo.*`) so no Arabic copy lives in source. Prices are stored as
 * INTEGER minor units. Remove once real onboarding/import exists.
 *
 * Note: for the demo we set `stock_levels` directly; the real flow derives
 * on-hand by posting incoming/outgoing documents to the ledger.
 */
interface SeedSpec {
  nameKey: string;
  category: string;
  unit: string;
  priceMajor: number;
  qty: number;
  lowStockThreshold: number;
}

const SPECS: readonly SeedSpec[] = [
  { nameKey: 'item1', category: 'tshirts', unit: 'piece', priceMajor: 250, qty: 24, lowStockThreshold: 10 },
  { nameKey: 'item2', category: 'jackets', unit: 'piece', priceMajor: 650, qty: 6, lowStockThreshold: 8 },
  { nameKey: 'item3', category: 'shoes', unit: 'pair', priceMajor: 1200, qty: 0, lowStockThreshold: 4 },
  { nameKey: 'item4', category: 'pants', unit: 'piece', priceMajor: 550, qty: 18, lowStockThreshold: 6 },
  { nameKey: 'item5', category: 'shirts', unit: 'piece', priceMajor: 480, qty: 3, lowStockThreshold: 5 },
  { nameKey: 'item6', category: 'accessories', unit: 'piece', priceMajor: 180, qty: 40, lowStockThreshold: 10 },
];

const MINOR_PER_MAJOR = 100;
const COST_RATIO = 0.6; // demo margin heuristic

export function seedDemoDataIfEmpty(): void {
  if (itemRepository.count() > 0) return;

  const ts = now();
  for (const spec of SPECS) {
    const id = newId();
    db.insert(schema.items)
      .values({
        id,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: i18n.t(`inventory.demo.${spec.nameKey}`),
        category: spec.category,
        unit: spec.unit,
        costPrice: Math.round(spec.priceMajor * COST_RATIO) * MINOR_PER_MAJOR,
        salePrice: spec.priceMajor * MINOR_PER_MAJOR,
        currency: 'EGP',
        lowStockThreshold: spec.lowStockThreshold,
      })
      .run();
    db.insert(schema.stockLevels).values({ itemId: id, qtyOnHand: spec.qty, updatedAt: ts }).run();
  }
}
