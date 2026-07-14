// Test-only SQLite. Real SQL via better-sqlite3 (node), wrapped in the same
// Drizzle schema the app uses — so repositories are exercised against real SQL,
// not mocks (AGENTS.md testing rule). NOT imported by app code.
//
// DDL mirrors src/db/migrate.ts (Step-1 subset). Keep in sync; a drift shows up
// as a failing repo test, which is the point.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

const DDL = `
CREATE TABLE items (
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
  photo_uri TEXT,
  tags TEXT,
  notes TEXT
);
CREATE TABLE categories (
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
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE documents (
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
CREATE TABLE document_lines (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  document_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL DEFAULT 0,
  list_price INTEGER,
  title TEXT,
  note TEXT,
  image_uri TEXT
);
CREATE TABLE stock_levels (
  item_id TEXT PRIMARY KEY,
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  name TEXT NOT NULL,
  phone TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  name TEXT NOT NULL,
  phone TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0
);
-- The CHECK constraints are the point, not decoration: they are what makes a
-- bad payment insert fail *inside* documentRepository.create()'s transaction,
-- rolling the document and its lines back with it (TC-2.2).
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  direction INTEGER NOT NULL CHECK (direction IN (-1, 1)),
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at INTEGER NOT NULL,
  account TEXT NOT NULL,
  ref_kind TEXT,
  ref_id TEXT,
  note TEXT,
  attachments TEXT
);
CREATE INDEX idx_lines_document ON document_lines(document_id);
CREATE INDEX idx_lines_item ON document_lines(item_id);
CREATE INDEX idx_tx_ref ON transactions(ref_kind, ref_id);
CREATE INDEX idx_tx_occurred ON transactions(occurred_at);
CREATE INDEX idx_tx_account ON transactions(account);
`;

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** Fresh in-memory DB with the app DDL applied. One per test for isolation. */
export function makeTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}
