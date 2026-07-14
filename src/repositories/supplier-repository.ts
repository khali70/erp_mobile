import { and, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Supplier } from '@/db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupplierDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export interface CreateSupplierInput {
  name: string;
  phone?: string | null;
}

export interface UpdateSupplierInput {
  id: string;
  name: string;
  phone?: string | null;
}

/**
 * Thrown when a caller tries to edit or archive a SENTINEL party.
 *
 * Archiving the walk-in sentinel is the catastrophic failure mode of this whole
 * design: every walk-in document in history would point at a soft-deleted row,
 * and every join would silently drop those documents from every report. Not a
 * crash — a quiet, permanent, invisible loss. Hence a hard error.
 */
export class SystemPartyError extends Error {
  constructor(id: string) {
    super(`Party ${id} is a system party and cannot be edited or archived`);
    this.name = 'SystemPartyError';
  }
}

export function createSupplierRepository(db: SupplierDb, clock: () => number = now) {
  /** Live AND real — the sentinel is neither listed nor counted (guards #1, #7). */
  const realAndLive = and(isNull(schema.suppliers.deletedAt), eq(schema.suppliers.isSystem, 0));

  function assertNotSystem(id: string): void {
    const row = db
      .select({ isSystem: schema.suppliers.isSystem })
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, id))
      .get();
    if (row?.isSystem === 1) throw new SystemPartyError(id);
  }

  return {
    /** Real suppliers only. The owner must never see "نقدي (بدون مورد)" in his list. */
    list(): Supplier[] {
      return db.select().from(schema.suppliers).where(realAndLive).all();
    },

    /** Fetch one by id — sentinels INCLUDED, so a walk-in document can resolve its party name. */
    get(id: string): Supplier | null {
      return (
        db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get() ?? null
      );
    },

    // Edit identity fields only. `balance` is retired (debt is derived) and is
    // never written here — or anywhere.
    update(input: UpdateSupplierInput): void {
      assertNotSystem(input.id);
      db.update(schema.suppliers)
        .set({ name: input.name, phone: input.phone ?? null, updatedAt: clock() })
        .where(eq(schema.suppliers.id, input.id))
        .run();
    },

    create(input: CreateSupplierInput): Supplier {
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
      db.insert(schema.suppliers).values(row).run();
      return row as Supplier;
    },

    archive(id: string): void {
      assertNotSystem(id);
      const ts = clock();
      db.update(schema.suppliers)
        .set({ deletedAt: ts, updatedAt: ts })
        .where(eq(schema.suppliers.id, id))
        .run();
    },

    /** Real suppliers only — a shop with no real suppliers must read as EMPTY, not "1". */
    count(): number {
      return db.select().from(schema.suppliers).where(realAndLive).all().length;
    },
  };
}

export type SupplierRepository = ReturnType<typeof createSupplierRepository>;
