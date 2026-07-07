import { db, schema } from './client';
import i18n from '@/i18n';
import { newId, now } from '@/utils/id';
import { itemRepository } from '@/repositories/item-repository.client';
import { documentRepository } from '@/repositories/document-repository.client';

/**
 * Dev seed: inserts a placeholder catalog into SQLite on first run so screens
 * render real repository data (not hardcoded arrays). Names come from i18n
 * (`inventory.demo.*`) so no Arabic copy lives in source. Prices are stored as
 * INTEGER minor units. Remove once real onboarding/import exists.
 *
 * Opening stock is seeded as POSTED incoming documents (ledger-backed), NOT by
 * writing `stock_levels` directly — otherwise the first real posting's
 * recompute (on-hand = Σ ledger) would wipe the seeded quantity.
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
    const costMinor = Math.round(spec.priceMajor * COST_RATIO) * MINOR_PER_MAJOR;
    db.insert(schema.items)
      .values({
        id,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: i18n.t(`inventory.demo.${spec.nameKey}`),
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
      documentRepository.create({
        kind: 'incoming',
        status: 'posted',
        note: i18n.t('inventory.demo.openingBalance'),
        lines: [{ itemId: id, qty: spec.qty, unitPrice: costMinor }],
      });
    }
  }
}
