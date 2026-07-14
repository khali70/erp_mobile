import { and, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Customer } from '@/db/schema';
import { SystemPartyError } from './supplier-repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomerDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
}

export interface UpdateCustomerInput {
  id: string;
  name: string;
  phone?: string | null;
}

/**
 * The customer sentinel earns its place even though AR is deprecated: a walk-in
 * SALE still needs a `ref_kind='sale'` payment row to point somewhere, and
 * keeping both party tables symmetric means AR can be un-deprecated later
 * without a migration. Same four guards as suppliers.
 */
export function createCustomerRepository(db: CustomerDb, clock: () => number = now) {
  const realAndLive = and(isNull(schema.customers.deletedAt), eq(schema.customers.isSystem, 0));

  function assertNotSystem(id: string): void {
    const row = db
      .select({ isSystem: schema.customers.isSystem })
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .get();
    if (row?.isSystem === 1) throw new SystemPartyError(id);
  }

  return {
    /** Real customers only — the sentinel is never shown as if it were a person. */
    list(): Customer[] {
      return db.select().from(schema.customers).where(realAndLive).all();
    },

    /** Fetch one by id — sentinels INCLUDED, so a walk-in document can resolve its party name. */
    get(id: string): Customer | null {
      return (
        db.select().from(schema.customers).where(eq(schema.customers.id, id)).get() ?? null
      );
    },

    // Edit identity fields only. `balance` is retired and never written here.
    update(input: UpdateCustomerInput): void {
      assertNotSystem(input.id);
      db.update(schema.customers)
        .set({ name: input.name, phone: input.phone ?? null, updatedAt: clock() })
        .where(eq(schema.customers.id, input.id))
        .run();
    },

    create(input: CreateCustomerInput): Customer {
      const ts = clock();
      const row = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: input.name,
        phone: input.phone ?? null,
        balance: 0,
        isSystem: 0, // only the seed may mint a sentinel
      };
      db.insert(schema.customers).values(row).run();
      return row as Customer;
    },

    archive(id: string): void {
      assertNotSystem(id);
      const ts = clock();
      db.update(schema.customers)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(eq(schema.customers.id, id))
        .run();
    },

    /** Real customers only — a shop with no real customers must read as EMPTY. */
    count(): number {
      return db.select().from(schema.customers).where(realAndLive).all().length;
    },
  };
}

export type CustomerRepository = ReturnType<typeof createCustomerRepository>;
