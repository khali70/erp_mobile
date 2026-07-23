import { and, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';
import { now } from '@/utils/id';

/**
 * SENTINEL PARTIES — the null-object pattern, applied to `documents.party_id`.
 *
 * A walk-in purchase ("شراء نقدي مباشر (بدون مورد)") used to set `party_id =
 * null`. That null forced a special case into EVERY query and, worse, left a
 * cash payment with nothing to point at — a `ref_kind='supplier'` transaction
 * needs a supplier id. Seeding one sentinel row per party table means
 * `party_id` is never null and a walk-in payment is an utterly ordinary row.
 * The special case is handled ONCE, here in the seed, instead of everywhere.
 *
 * A sentinel is DANGEROUS unless it is defended. All four guards are required
 * and all four live outside this file:
 *   1. hidden from `list()` / `count()`        → supplier/customer-repository
 *   2. `update()` / `archive()` REJECT it      → supplier/customer-repository
 *      ↑ the catastrophic one: archive the sentinel and every walk-in document
 *        in history orphans — its party_id points at a soft-deleted row, and
 *        every join silently drops those documents from every report.
 *   3. excluded from debt + totalPayables      → debt-repository
 *   4. STILL VISIBLE in the cash book          → transaction-repository (no filter)
 *      ↑ the money genuinely left the drawer. Debt hides the sentinel; cash
 *        hides nothing. A cash book with a hole in it is worse than none.
 */

export const WALKIN_SUPPLIER_ID = 'system-walkin-supplier';
export const WALKIN_CUSTOMER_ID = 'system-walkin-customer';

// The label the owner already sees on the walk-in option. Not i18n'd: this is a
// DATA row, not UI copy — the screens render it via `documents.*.walkIn`, and a
// party's stored name must not change when the app language does.
const WALKIN_SUPPLIER_NAME = 'نقدي (بدون مورد)';
const WALKIN_CUSTOMER_NAME = 'نقدي (بدون زبون)';

// Injectable so migrate.ts (expo-sqlite) and the tests (better-sqlite3) run the
// exact same code. Any sync Drizzle SQLite db with our schema satisfies this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SentinelDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

/** True when the id is one of the seeded sentinels (cheap, no db round-trip). */
export function isSentinelId(id: string | null | undefined): boolean {
  return id === WALKIN_SUPPLIER_ID || id === WALKIN_CUSTOMER_ID;
}

/**
 * Seed the two sentinel parties. IDEMPOTENT — this runs on EVERY app boot, so
 * it must be INSERT OR IGNORE on a fixed id (`onConflictDoNothing` on the PK).
 * A duplicate sentinel would silently split walk-in history in two.
 */
export function seedSentinels(db: SentinelDb, ts: number = now()): void {
  // `balance` is RETIRED (debt is derived) and is written NOWHERE, including
  // here — the column keeps its DB default.
  db.insert(schema.suppliers)
    .values({
      id: WALKIN_SUPPLIER_ID,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      name: WALKIN_SUPPLIER_NAME,
      phone: null,
      isSystem: 1,
    })
    .onConflictDoNothing()
    .run();

  db.insert(schema.customers)
    .values({
      id: WALKIN_CUSTOMER_ID,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      name: WALKIN_CUSTOMER_NAME,
      phone: null,
      isSystem: 1,
    })
    .onConflictDoNothing()
    .run();
}

/**
 * The sentinel rows as raw `INSERT OR IGNORE` SQL, for the prod-schema
 * provisioning artifact. It is the SAME two rows `seedSentinels()` writes with
 * Drizzle — id, name and is_system come from the constants above, so the .sql
 * file cannot drift from the runtime seed. `INSERT OR IGNORE` on the fixed PK
 * makes it a no-op once the row exists, so a phone booting against a DB the
 * script provisioned re-runs `seedSentinels()` harmlessly. `balance` is omitted
 * on purpose (retired, DB default). `ts` defaults to 0 — the null-object rows
 * predate everything; a fixed epoch keeps the artifact deterministic.
 */
export function sentinelInsertSql(ts = 0): string {
  const cols = '(id, created_at, updated_at, deleted_at, name, phone, is_system)';
  return [
    `INSERT OR IGNORE INTO suppliers ${cols}`,
    `VALUES ('${WALKIN_SUPPLIER_ID}', ${ts}, ${ts}, NULL, '${WALKIN_SUPPLIER_NAME}', NULL, 1);`,
    `INSERT OR IGNORE INTO customers ${cols}`,
    `VALUES ('${WALKIN_CUSTOMER_ID}', ${ts}, ${ts}, NULL, '${WALKIN_CUSTOMER_NAME}', NULL, 1);`,
  ].join('\n');
}

/**
 * Repoint every legacy `party_id IS NULL` document at the matching sentinel:
 * purchases (`kind='in'`) at the walk-in supplier, sales (`kind='out'`) at the
 * walk-in customer. Runs in the same pass as the seed, on every boot — a no-op
 * once there are no nulls left.
 */
export function backfillWalkInParties(db: SentinelDb, ts: number = now()): void {
  db.update(schema.documents)
    .set({ partyId: WALKIN_SUPPLIER_ID, updatedAt: ts })
    .where(and(isNull(schema.documents.partyId), eq(schema.documents.kind, 'in')))
    .run();

  db.update(schema.documents)
    .set({ partyId: WALKIN_CUSTOMER_ID, updatedAt: ts })
    .where(and(isNull(schema.documents.partyId), eq(schema.documents.kind, 'out')))
    .run();
}
