import { openDatabaseSync } from 'expo-sqlite';

// Forward-only bootstrap migration, run once at app boot.
// Additive only. Never destructive without an explicit backup step.
export function runMigrations(): void {
  const sqlite = openDatabaseSync('erp.db');
  sqlite.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL,
      barcode TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_price INTEGER NOT NULL DEFAULT 0,
      sale_price INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EGP',
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      kind TEXT NOT NULL,
      direction INTEGER NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_lines_document ON document_lines(document_id);
    CREATE INDEX IF NOT EXISTS idx_lines_item ON document_lines(item_id);
  `);
}
