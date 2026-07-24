import { db } from './client';
import type { SentinelDb } from './sentinels';
import { seedDemoData } from './demo-seed';
import i18n from '@/i18n';
import { newId, now } from '@/utils/id';
import { itemRepository } from '@/repositories/item-repository.client';
import { categoryRepository } from '@/repositories/category-repository.client';
import { documentRepository } from '@/repositories/document-repository.client';

/**
 * THE DEV/PROD GATE — single source of truth.
 *
 * `__DEV__` is a BUILD-TIME constant the Metro/Expo transform inlines: `true` in
 * a dev build, `false` in any release (production) build. It is NOT a runtime
 * flag a shipped user could flip — it is compiled away entirely. So this is the
 * one and only switch deciding whether the demo catalog ships, and no other
 * boolean anywhere keys off it independently: every gate reads THIS constant.
 */
export const DEMO_SEED_ENABLED = __DEV__;

// The seven default categories. `color` is a theme color token resolved by
// CategoryAvatar; `i18nKey` maps to inventory.categories.<key> for the label.
// Users can add more at runtime — these are just the starting registry.
const DEFAULT_CATEGORIES: readonly { name: string; color: string; i18nKey: string }[] = [
  { name: 'tshirts', color: 'emerald', i18nKey: 'tshirts' },
  { name: 'shoes', color: 'amber', i18nKey: 'shoes' },
  { name: 'pants', color: 'violet', i18nKey: 'pants' },
  { name: 'shirts', color: 'sky', i18nKey: 'shirts' },
  { name: 'winterwear', color: 'blue', i18nKey: 'winterwear' },
  { name: 'childrenwear', color: 'orange', i18nKey: 'childrenwear' },
  { name: 'underwear', color: 'rose', i18nKey: 'underwear' },
  { name: "shirt", color: "blue", i18nKey: "shirt" },
  { name: 'assets', color: 'pink', i18nKey: 'assets' },
  { name: 'other', color: 'slate', i18nKey: 'other' },
];

/**
 * Seed the default category registry once. Idempotent (create is insert-or-return).
 *
 * DECISION: these SHIP IN PRODUCTION, ungated — unlike the demo catalog below.
 * They are functional REFERENCE DATA, not dummy data: an item's `category` is a
 * name that must resolve against this registry, and a fresh prod install with an
 * empty registry would hand the owner an item form with no categories to pick and
 * no signal that categories are how the app organizes stock. They carry ZERO
 * fabricated business history — no items, no stock, no money, no documents — so
 * keeping them does not violate "a prod install ships no dummy data". They are
 * i18n-keyed config, and the owner can rename/extend them at runtime.
 */
export function seedCategoriesIfEmpty(): void {
  if (categoryRepository.count() > 0) return;
  DEFAULT_CATEGORIES.forEach((c, i) =>
    categoryRepository.create({ name: c.name, color: c.color, i18nKey: c.i18nKey, sortOrder: i }),
  );
}

/**
 * On-device wrapper around the pure `seedDemoData` core. Binds the real client
 * singletons + i18n + clock, and passes the `DEMO_SEED_ENABLED` gate — so in a
 * production build this is a guaranteed no-op (no demo items, no opening-stock
 * documents; screens show real empty states). Dev builds seed exactly as before.
 */
export function seedDemoDataIfEmpty(): void {
  seedDemoData(
    db as unknown as SentinelDb,
    {
      itemCount: () => itemRepository.count(),
      createDocument: (input) => documentRepository.create(input),
      translate: (key) => i18n.t(key),
      newId,
      now,
    },
    DEMO_SEED_ENABLED,
  );
}
