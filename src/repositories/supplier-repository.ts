import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { newId, now } from '@/utils/id';
import type { Supplier } from '@/db/schema';

export interface CreateSupplierInput {
  name: string;
  phone?: string | null;
}

export interface UpdateSupplierInput {
  id: string;
  name: string;
  phone?: string | null;
}

// Repositories are the only db consumers. Return typed domain objects.
export const supplierRepository = {
  list(): Supplier[] {
    return db.select().from(schema.suppliers).where(isNull(schema.suppliers.deletedAt)).all();
  },

  // Edit identity fields only; `balance` is ledger-derived and never set here.
  update(input: UpdateSupplierInput): void {
    db.update(schema.suppliers)
      .set({ name: input.name, phone: input.phone ?? null, updatedAt: now() })
      .where(eq(schema.suppliers.id, input.id))
      .run();
  },

  create(input: CreateSupplierInput): Supplier {
    const ts = now();
    const row = {
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      name: input.name,
      phone: input.phone ?? null,
      balance: 0,
    };
    db.insert(schema.suppliers).values(row).run();
    return row as Supplier;
  },

  archive(id: string): void {
    const ts = now();
    db.update(schema.suppliers)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(schema.suppliers.id, id))
      .run();
  },

  count(): number {
    return db.select().from(schema.suppliers).where(isNull(schema.suppliers.deletedAt)).all().length;
  },
};
