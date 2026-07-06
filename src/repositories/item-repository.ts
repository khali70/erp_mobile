import { and, eq, isNull, ne } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Item } from '@/db/schema';
import type { DocDb } from './document-repository';

/** An item joined with its cached on-hand quantity (from the stock ledger). */
export interface ItemWithStock {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  barcode: string | null;
  costPrice: number; // minor units
  salePrice: number; // minor units
  lowStockThreshold: number;
  qtyOnHand: number;
}

export interface CreateItemInput {
  name: string;
  category?: string | null;
  unit?: string;
  barcode?: string | null;
  costPrice?: number; // minor units
  salePrice?: number; // minor units
  lowStockThreshold?: number;
}

export type UpdateItemInput = Partial<CreateItemInput>;

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
          lowStockThreshold: schema.items.lowStockThreshold,
          qtyOnHand: schema.stockLevels.qtyOnHand,
        })
        .from(schema.items)
        .leftJoin(schema.stockLevels, eq(schema.stockLevels.itemId, schema.items.id))
        .where(isNull(schema.items.deletedAt))
        .all()
        .map((row) => ({ ...row, qtyOnHand: row.qtyOnHand ?? 0 }));
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
        lowStockThreshold: input.lowStockThreshold ?? 0,
        photoUri: null,
      };
      database.insert(schema.items).values(row).run();
      return row as Item;
    },

    update(id: string, patch: UpdateItemInput): void {
      if (patch.barcode && barcodeTaken(patch.barcode, id)) {
        throw new DuplicateBarcodeError(patch.barcode);
      }
      database
        .update(schema.items)
        .set({ ...patch, updatedAt: now() })
        .where(eq(schema.items.id, id))
        .run();
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
