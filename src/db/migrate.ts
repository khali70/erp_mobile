import { openDatabaseSync } from 'expo-sqlite';

// Forward-only bootstrap migration, run once at app boot.
// Additive only. Never destructive without an explicit backup step.
export function runMigrations(): void {
  const sqlite = openDatabaseSync('erp.db');

  // PRAGMA journal_mode returns a row ("wal"). execSync is result-less and
  // rejects any row-returning statement with a native NPE — use a result-aware
  // call so the row is consumed. (WAL is already expo-sqlite's default; this
  // just makes it explicit.)
  sqlite.getFirstSync('PRAGMA journal_mode = WAL;');

  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL,
      category TEXT,
      barcode TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_price INTEGER NOT NULL DEFAULT 0,
      sale_price INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EGP',
      low_stock_threshold INTEGER NOT NULL DEFAULT 0,
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      kind TEXT NOT NULL,
      direction INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'posted',
      doc_no TEXT,
      doc_date INTEGER,
      total_amount INTEGER NOT NULL DEFAULT 0,
      posted_at INTEGER,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS document_lines (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      document_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_levels (
      item_id TEXT PRIMARY KEY,
      qty_on_hand INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      balance INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      balance INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_lines_document ON document_lines(document_id);
    CREATE INDEX IF NOT EXISTS idx_lines_item ON document_lines(item_id);
  `);

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
}

function addColumnIfMissing(
  sqlite: ReturnType<typeof openDatabaseSync>,
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
