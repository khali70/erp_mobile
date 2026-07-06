import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { newId, now } from '@/utils/id';
import type { Item } from '@/db/schema';

/** An item joined with its cached on-hand quantity (from the stock ledger). */
export interface ItemWithStock {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  costPrice: number; // minor units
  salePrice: number; // minor units
  lowStockThreshold: number;
  qtyOnHand: number;
}

export interface CreateItemInput {
  name: string;
  category?: string | null;
  unit?: string;
  costPrice?: number; // minor units
  salePrice?: number; // minor units
  lowStockThreshold?: number;
}

// Repositories are the only db consumers. Return typed domain objects.
export const itemRepository = {
  list(): Item[] {
    return db.select().from(schema.items).where(isNull(schema.items.deletedAt)).all();
  },

  /** Live items with their derived on-hand quantity (0 when no ledger rows yet). */
  listWithStock(): ItemWithStock[] {
    return db
      .select({
        id: schema.items.id,
        name: schema.items.name,
        category: schema.items.category,
        unit: schema.items.unit,
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
    const ts = now();
    const row = {
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      name: input.name,
      category: input.category ?? null,
      unit: input.unit ?? 'pcs',
      costPrice: input.costPrice ?? 0,
      salePrice: input.salePrice ?? 0,
      currency: 'EGP',
      lowStockThreshold: input.lowStockThreshold ?? 0,
    };
    db.insert(schema.items).values(row).run();
    return row as Item;
  },

  archive(id: string): void {
    const ts = now();
    db.update(schema.items)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(schema.items.id, id))
      .run();
  },

  count(): number {
    return db.select().from(schema.items).where(isNull(schema.items.deletedAt)).all().length;
  },
};
