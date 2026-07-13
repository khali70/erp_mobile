import type { openDatabaseSync } from 'expo-sqlite';
import { sqlite } from './client';
import { initAttachmentsDb } from './attachments-client';

// Forward-only bootstrap migration, run once at app boot.
// Additive only. Never destructive without an explicit backup step.
// Reuses the single shared connection from ./client (a second
// openDatabaseSync handle raced the change-listener handle and could NPE in
// prepareSync on a cold first boot). WAL is expo-sqlite's default — no PRAGMA.
export function runMigrations(): void {
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
      pricing_mode TEXT NOT NULL DEFAULT 'fixed',
      min_price INTEGER,
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
      party_id TEXT,
      note TEXT,
      attachments TEXT
    );

    CREATE TABLE IF NOT EXISTS document_lines (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      document_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL DEFAULT 0,
      list_price INTEGER
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

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      icon TEXT,
      i18n_key TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL UNIQUE
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

  // Attachment bytes live in a separate DB file — bootstrap it here too.
  initAttachmentsDb();
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
