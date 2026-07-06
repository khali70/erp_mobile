import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { newId, now } from '@/utils/id';
import type { Item } from '@/db/schema';

// Repositories are the only db consumers. Return typed domain objects.
export const itemRepository = {
  list(): Item[] {
    return db
      .select()
      .from(schema.items)
      .where(isNull(schema.items.deletedAt))
      .all();
  },

  create(input: { name: string; unit?: string; costPrice?: number; salePrice?: number }): Item {
    const ts = now();
    const row = {
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      name: input.name,
      unit: input.unit ?? 'pcs',
      costPrice: input.costPrice ?? 0,
      salePrice: input.salePrice ?? 0,
      currency: 'EGP',
    };
    db.insert(schema.items).values(row).run();
    return row as Item;
  },

  archive(id: string): void {
    db.update(schema.items)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(schema.items.id, id))
      .run();
  },
};
