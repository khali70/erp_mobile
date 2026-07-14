import { db, schema } from './client';
import i18n from '@/i18n';
import { newId, now } from '@/utils/id';
import { itemRepository } from '@/repositories/item-repository.client';
import { categoryRepository } from '@/repositories/category-repository.client';
import { documentRepository } from '@/repositories/document-repository.client';

// The seven default categories. `color` is a theme color token resolved by
// CategoryAvatar; `i18nKey` maps to inventory.categories.<key> for the label.
// Users can add more at runtime — these are just the starting registry.
const DEFAULT_CATEGORIES: readonly { name: string; color: string; i18nKey: string }[] = [
  { name: 'tshirts', color: 'emerald', i18nKey: 'tshirts' },
  { name: 'jackets', color: 'cyan', i18nKey: 'jackets' },
  { name: 'shoes', color: 'amber', i18nKey: 'shoes' },
  { name: 'pants', color: 'violet', i18nKey: 'pants' },
  { name: 'shirts', color: 'sky', i18nKey: 'shirts' },
  { name: 'accessories', color: 'pink', i18nKey: 'accessories' },
  { name: 'other', color: 'slate', i18nKey: 'other' },
];

/** Seed the default category registry once. Idempotent (create is insert-or-return). */
export function seedCategoriesIfEmpty(): void {
  if (categoryRepository.count() > 0) return;
  DEFAULT_CATEGORIES.forEach((c, i) =>
    categoryRepository.create({ name: c.name, color: c.color, i18nKey: c.i18nKey, sortOrder: i }),
  );
}

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
const SPECS: readonly SeedSpec[] = [
  { nameKey: 'item1', category: 'tshirts',     unit: 'piece', priceMajor: 250,  costMajor: 160, qty: 24, lowStockThreshold: 10 }, // 36%
  { nameKey: 'item2', category: 'jackets',     unit: 'piece', priceMajor: 650,  costMajor: 455, qty: 6,  lowStockThreshold: 8 },  // 30%
  { nameKey: 'item3', category: 'shoes',       unit: 'pair',  priceMajor: 1200, costMajor: 780, qty: 0,  lowStockThreshold: 4 },  // 35%
  { nameKey: 'item4', category: 'pants',       unit: 'piece', priceMajor: 550,  costMajor: 330, qty: 18, lowStockThreshold: 6 },  // 40%
  { nameKey: 'item5', category: 'shirts',      unit: 'piece', priceMajor: 480,  costMajor: 336, qty: 3,  lowStockThreshold: 5 },  // 30%
  { nameKey: 'item6', category: 'accessories', unit: 'piece', priceMajor: 180,  costMajor: 99,  qty: 40, lowStockThreshold: 10 }, // 45%
];

const MINOR_PER_MAJOR = 100;

export function seedDemoDataIfEmpty(): void {
  if (itemRepository.count() > 0) return;

  const ts = now();
  for (const spec of SPECS) {
    const id = newId();
    const costMinor = spec.costMajor * MINOR_PER_MAJOR;
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
