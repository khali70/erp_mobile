import { and, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Supplier } from '@/db/schema';
import { createDebtRepository, type DebtDb } from './debt-repository';

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

/**
 * Thrown when a caller tries to archive a supplier the shop STILL OWES.
 *
 * The failure it prevents is silent, which is what makes it dangerous. Every debt
 * figure filters `deleted_at IS NULL`, so archiving a supplier owed 5,000 does
 * not warn, does not error and leaves no trace — total payables simply drops by
 * 5,000 and no screen in the app can tell the owner why. The money is still owed;
 * the man is still owed it; only the app has forgotten. Pay him off (or delete
 * the invoices) and he archives freely.
 *
 * `owed` rides along so the UI can name the amount instead of saying "no".
 */
export class SupplierHasDebtError extends Error {
  constructor(
    public readonly id: string,
    /** Minor units still owed. Always > 0 — a credit never blocks. */
    public readonly owed: number,
  ) {
    super(`Supplier ${id} still carries ${owed} of debt and cannot be archived`);
    this.name = 'SupplierHasDebtError';
  }
}

export function createSupplierRepository(db: SupplierDb, clock: () => number = now) {
  /** Live AND real — the sentinel is neither listed nor counted (guards #1, #7). */
  const realAndLive = and(isNull(schema.suppliers.deletedAt), eq(schema.suppliers.isSystem, 0));

  // Debt is DERIVED, and it is derived in exactly one place. Composing the debt
  // repository here rather than re-deriving `documents − transactions` locally is
  // what stops this guard drifting away from the number the debts screen shows —
  // a guard that disagrees with the figure it is guarding is worse than none.
  const debts = createDebtRepository(db as unknown as DebtDb, clock);

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
      // `balance` is RETIRED and is not written here — the column keeps its DB
      // default. Writing a 0 to it advertised a stored balance that nothing
      // maintains, next to a schema comment promising it is "never written".
      const row = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: input.name,
        phone: input.phone ?? null,
        isSystem: 0, // only the seed may mint a sentinel
      };
      db.insert(schema.suppliers).values(row).run();
      return { ...row, balance: 0 } as Supplier;
    },

    /**
     * Archive a supplier — but NEVER one the shop still owes.
     *
     * A supplier carrying debt cannot simply be removed: `realSuppliers()` and
     * every payables figure filter `deleted_at IS NULL`, so the archive would
     * silently subtract his 5,000 from what the owner believes he owes, with no
     * warning and no trace. The debt is real. Pay it (or delete the invoices that
     * created it) and he archives freely.
     *
     * Only a POSITIVE debt blocks. A supplier in CREDIT is a receivable, and
     * guarding him would strand him forever — no screen can pay a negative
     * balance back up to zero.
     */
    archive(id: string): void {
      assertNotSystem(id);
      const owed = debts.owed(id);
      if (owed > 0) throw new SupplierHasDebtError(id, owed);
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
