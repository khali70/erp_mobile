import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Item } from '@/db/schema';
import type { DocDb } from './document-repository';

/** Haggling policy for an item's sale price. See docs/plan/features/02. */
export type PricingMode = 'fixed' | 'negotiable';

/** An item joined with its cached on-hand quantity (from the stock ledger). */
export interface ItemWithStock {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  barcode: string | null;
  costPrice: number; // minor units
  salePrice: number; // minor units — the LIST price
  pricingMode: PricingMode;
  minPrice: number | null; // minor units; null = no floor
  lowStockThreshold: number;
  qtyOnHand: number;
  tags: string[];
  notes: string | null;
}

export interface CreateItemInput {
  name: string;
  category?: string | null;
  unit?: string;
  barcode?: string | null;
  costPrice?: number; // minor units
  salePrice?: number; // minor units
  pricingMode?: PricingMode; // default 'fixed'
  minPrice?: number | null; // minor units; null = no floor
  lowStockThreshold?: number;
  tags?: string[];
  notes?: string | null;
  photoUri?: string | null;
}

export type UpdateItemInput = Partial<CreateItemInput>;

/** Denormalized tag array is stored as a JSON string; tolerate legacy null. */
const parseTags = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const val = JSON.parse(raw);
    return Array.isArray(val) ? val.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
};

/** Case/space-insensitive match key for find-or-create dedupe. */
export const nameKey = (name: string): string => name.trim().toLowerCase();

/** The column is open TEXT; anything unrecognised falls back to the safe default. */
const toPricingMode = (raw: string | null): PricingMode =>
  raw === 'negotiable' ? 'negotiable' : 'fixed';

/** Thrown when a barcode collides with another live item. */
export class DuplicateBarcodeError extends Error {
  constructor(public readonly barcode: string) {
    super(`Barcode already in use: ${barcode}`);
    this.name = 'DuplicateBarcodeError';
  }
}

// Injectable so the same code runs on expo-sqlite (prod) and better-sqlite3
// (tests). The prod singleton `itemRepository` is exported below.
export function createItemRepository(database: DocDb) {
  function barcodeTaken(barcode: string, exceptId?: string): boolean {
    const conds = [eq(schema.items.barcode, barcode), isNull(schema.items.deletedAt)];
    if (exceptId) conds.push(ne(schema.items.id, exceptId));
    return (
      database.select({ id: schema.items.id }).from(schema.items).where(and(...conds)).all()
        .length > 0
    );
  }

  return {
    list(): Item[] {
      return database
        .select()
        .from(schema.items)
        .where(isNull(schema.items.deletedAt))
        .all();
    },

    getById(id: string): Item | null {
      return (
        database.select().from(schema.items).where(eq(schema.items.id, id)).get() ?? null
      );
    },

    /** Live items with derived on-hand (0 when no ledger rows yet). */
    listWithStock(): ItemWithStock[] {
      return database
        .select({
          id: schema.items.id,
          name: schema.items.name,
          category: schema.items.category,
          unit: schema.items.unit,
          barcode: schema.items.barcode,
          costPrice: schema.items.costPrice,
          salePrice: schema.items.salePrice,
          pricingMode: schema.items.pricingMode,
          minPrice: schema.items.minPrice,
          lowStockThreshold: schema.items.lowStockThreshold,
          tags: schema.items.tags,
          notes: schema.items.notes,
          qtyOnHand: schema.stockLevels.qtyOnHand,
        })
        .from(schema.items)
        .leftJoin(schema.stockLevels, eq(schema.stockLevels.itemId, schema.items.id))
        .where(isNull(schema.items.deletedAt))
        .all()
        .map((row) => ({
          ...row,
          qtyOnHand: row.qtyOnHand ?? 0,
          tags: parseTags(row.tags),
          pricingMode: toPricingMode(row.pricingMode),
        }));
    },

    /**
     * Find a live item by case-insensitive name within a category (null = any),
     * for fast-entry find-or-create dedupe. Returns the first match or null.
     */
    findByNameAndCategory(name: string, category: string | null): Item | null {
      const conds = [
        isNull(schema.items.deletedAt),
        eq(sql`lower(trim(${schema.items.name}))`, nameKey(name)),
      ];
      if (category !== null) conds.push(eq(schema.items.category, category));
      return database.select().from(schema.items).where(and(...conds)).get() ?? null;
    },

    create(input: CreateItemInput): Item {
      if (input.barcode && barcodeTaken(input.barcode)) {
        throw new DuplicateBarcodeError(input.barcode);
      }
      const ts = now();
      const row = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: input.name,
        category: input.category ?? null,
        barcode: input.barcode ?? null,
        unit: input.unit ?? 'pcs',
        costPrice: input.costPrice ?? 0,
        salePrice: input.salePrice ?? 0,
        currency: 'EGP',
        pricingMode: input.pricingMode ?? 'fixed',
        minPrice: input.minPrice ?? null,
        lowStockThreshold: input.lowStockThreshold ?? 0,
        photoUri: input.photoUri ?? null,
        tags: input.tags && input.tags.length ? JSON.stringify(input.tags) : null,
        notes: input.notes ?? null,
      };
      database.insert(schema.items).values(row).run();
      return row as Item;
    },

    update(id: string, patch: UpdateItemInput): void {
      if (patch.barcode && barcodeTaken(patch.barcode, id)) {
        throw new DuplicateBarcodeError(patch.barcode);
      }
      // `tags` is a string[] in the input but a JSON TEXT column — serialize it.
      const { tags, ...rest } = patch;
      const set: Record<string, unknown> = { ...rest, updatedAt: now() };
      if (tags !== undefined) set.tags = tags.length ? JSON.stringify(tags) : null;
      database.update(schema.items).set(set).where(eq(schema.items.id, id)).run();
    },

    /** Archive (soft-delete). Never hard-delete an item with history. */
    archive(id: string): void {
      const ts = now();
      database
        .update(schema.items)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(eq(schema.items.id, id))
        .run();
    },

    count(): number {
      return database
        .select({ id: schema.items.id })
        .from(schema.items)
        .where(isNull(schema.items.deletedAt))
        .all().length;
    },
  };
}

export type ItemRepository = ReturnType<typeof createItemRepository>;
