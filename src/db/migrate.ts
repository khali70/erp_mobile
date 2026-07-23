import type { SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { db, sqlite } from './client';
import { initAttachmentsDb } from './attachments-client';
import { APP_SCHEMA_VERSION } from './schema-version';
import {
  CORE_DDL,
  DOCS_PARTY_INDEX_DDL,
  EXPENSES_DDL,
  TRANSACTIONS_DDL,
  TRANSACTIONS_INDEXES_DDL,
} from './ddl';
import { backfillWalkInParties, seedSentinels, type SentinelDb } from './sentinels';

// Forward-only bootstrap migration, run once at app boot.
// Additive only. Never destructive without an explicit backup step.
// Reuses the single shared connection from ./client (a second
// openDatabaseSync handle raced the change-listener handle and could NPE in
// prepareSync on a cold first boot). WAL is expo-sqlite's default — no PRAGMA.
export function runMigrations(): void {
  migrateErpDatabase(sqlite, db as unknown as SentinelDb);

  // Attachment bytes live in a separate DB file — bootstrap it here too.
  initAttachmentsDb();
}

/**
 * The migration pass itself, against an ARBITRARY handle.
 *
 * `runMigrations()` above points it at the live singletons. RESTORE points it at
 * the file it has just copied over the live path (through a fresh connection,
 * because the singleton is closed for the swap) — a backup taken by an older
 * build is missing later columns, and this is the ONLY code that adds them.
 * Extracted rather than duplicated for the reason written at the top of ./ddl:
 * a second copy of a migration drifts, and the drift is invisible.
 */
export function migrateErpDatabase(sqlite: SQLiteDatabase, db: SentinelDb): void {
  // The core schema (items, documents, lines, stock, parties, categories, tags).
  // Its SQL lives in ./ddl so the prod-schema generator runs the SAME statements
  // the phone runs — a hand-copied second version would drift silently.
  sqlite.execSync(CORE_DDL);

  // The CASH BOOK and EXPENSES. Their DDL lives in ./ddl so this boot path and
  // the test harness run the SAME SQL (a hand-copied second version drifts, and
  // the drift is invisible: green tests against a schema the phone does not
  // have). IF NOT EXISTS throughout — this runs on every single boot.
  //
  // The transactions INDEXES are deliberately NOT run here: `idx_tx_doc` is on
  // `doc_id`, which an upgraded install does not have until the back-fill below
  // adds it. Table first, column second, indexes last.
  sqlite.execSync(TRANSACTIONS_DDL);
  sqlite.execSync(EXPENSES_DDL);

  // Additive column back-fills for DBs created by an earlier schema.
  // SQLite has no "ADD COLUMN IF NOT EXISTS"; a duplicate add throws — ignore it.
  addColumnIfMissing(sqlite, 'items', 'category', 'TEXT');
  addColumnIfMissing(sqlite, 'items', 'low_stock_threshold', 'INTEGER NOT NULL DEFAULT 0');
  // documents draft/posted lifecycle + numbering (additive on upgraded installs).
  addColumnIfMissing(sqlite, 'documents', 'status', "TEXT NOT NULL DEFAULT 'posted'");
  addColumnIfMissing(sqlite, 'documents', 'doc_no', 'TEXT');
  addColumnIfMissing(sqlite, 'documents', 'doc_date', 'INTEGER');
  addColumnIfMissing(sqlite, 'documents', 'total_amount', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'documents', 'posted_at', 'INTEGER');
  // Counterparty FK + receipt note/attachments (additive on upgraded installs).
  addColumnIfMissing(sqlite, 'documents', 'party_id', 'TEXT');
  addColumnIfMissing(sqlite, 'documents', 'attachments', 'TEXT');
  // Rich items: denormalized tag-name array (JSON) + free notes.
  addColumnIfMissing(sqlite, 'items', 'tags', 'TEXT');
  addColumnIfMissing(sqlite, 'items', 'notes', 'TEXT');
  // Fast-entry line provenance (typed title/note/photo; item_id stays identity).
  addColumnIfMissing(sqlite, 'document_lines', 'title', 'TEXT');
  addColumnIfMissing(sqlite, 'document_lines', 'note', 'TEXT');
  addColumnIfMissing(sqlite, 'document_lines', 'image_uri', 'TEXT');
  // Negotiated pricing: per-item haggling policy + floor, and the list price the
  // line was sold against (null on legacy rows — a discount is unknowable there).
  addColumnIfMissing(sqlite, 'items', 'pricing_mode', "TEXT NOT NULL DEFAULT 'fixed'");
  addColumnIfMissing(sqlite, 'items', 'min_price', 'INTEGER');
  addColumnIfMissing(sqlite, 'document_lines', 'list_price', 'INTEGER');
  // Sentinel (null-object) parties — walk-in absorbers, so party_id is never null.
  addColumnIfMissing(sqlite, 'suppliers', 'is_system', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'customers', 'is_system', 'INTEGER NOT NULL DEFAULT 0');
  // Expenses: the optional columns, for an install whose `expenses` table was
  // created by an earlier, narrower version of the DDL above. NOT NULL columns
  // are absent from this list on purpose — SQLite cannot ADD one without a
  // default, and every one of them is already in the CREATE. Note there is no
  // `paid` column here and there never will be: an expense's debt is derived
  // (total_amount − its transactions), exactly as a supplier's is.
  addColumnIfMissing(sqlite, 'expenses', 'category', 'TEXT');
  addColumnIfMissing(sqlite, 'expenses', 'party_name', 'TEXT');
  addColumnIfMissing(sqlite, 'expenses', 'note', 'TEXT');
  addColumnIfMissing(sqlite, 'expenses', 'attachments', 'TEXT');
  // PROVENANCE on the cash book: which document, if any, this money row was born
  // with. NOT an allocation link (see schema.ts). Nullable — a payment made later
  // from the سداد sheet points at the supplier and carries no document.
  addColumnIfMissing(sqlite, 'transactions', 'doc_id', 'TEXT');

  // Indexes LAST — every column they touch exists by now, on a fresh install and
  // an upgraded one alike.
  //
  // idx_docs_party is what stops `owed()` full-scanning `documents`. It is read
  // on every focus of the debts screen and inside computeDashboardStats() on
  // Home, once per supplier; without it the shop's slowest screen is its home.
  sqlite.execSync(TRANSACTIONS_INDEXES_DDL);
  sqlite.execSync(DOCS_PARTY_INDEX_DDL);

  // Seed the sentinels and repoint legacy null-party documents at them. BOTH are
  // idempotent (INSERT OR IGNORE on a fixed id; the backfill is a no-op once no
  // nulls remain), which they must be — this runs on every single app boot.
  seedSentinels(db);
  backfillWalkInParties(db);

  // STAMP the schema generation, last — a file only claims a version once every
  // statement above has succeeded against it. RESTORE reads this back with
  // `PRAGMA user_version` to tell an old backup (migrate it forward) from one
  // written by a future build (refuse it: forward-only migrations cannot undo).
  sqlite.execSync(`PRAGMA user_version = ${APP_SCHEMA_VERSION};`);
}

/** Wrap a raw handle in the Drizzle surface `seedSentinels` needs. */
export function drizzleFor(handle: SQLiteDatabase): SentinelDb {
  return drizzle(handle, { schema }) as unknown as SentinelDb;
}

function addColumnIfMissing(
  sqlite: SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  try {
    sqlite.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch {
    // Column already exists — expected on upgraded installs.
  }
}
