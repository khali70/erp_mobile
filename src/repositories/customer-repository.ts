import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { newId, now } from '@/utils/id';
import type { Customer } from '@/db/schema';

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
}

export interface UpdateCustomerInput {
  id: string;
  name: string;
  phone?: string | null;
}

// Repositories are the only db consumers. Return typed domain objects.
export const customerRepository = {
  list(): Customer[] {
    return db.select().from(schema.customers).where(isNull(schema.customers.deletedAt)).all();
  },

  // Edit identity fields only; `balance` is ledger-derived and never set here.
  update(input: UpdateCustomerInput): void {
    db.update(schema.customers)
      .set({ name: input.name, phone: input.phone ?? null, updatedAt: now() })
      .where(eq(schema.customers.id, input.id))
      .run();
  },

  create(input: CreateCustomerInput): Customer {
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
    db.insert(schema.customers).values(row).run();
    return row as Customer;
  },

  archive(id: string): void {
    const ts = now();
    db.update(schema.customers)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(schema.customers.id, id))
      .run();
  },

  count(): number {
    return db.select().from(schema.customers).where(isNull(schema.customers.deletedAt)).all().length;
  },
};
