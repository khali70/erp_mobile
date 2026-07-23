-- prod-schema.sql — GENERATED, DO NOT EDIT BY HAND.
--
-- Provisions a clean production erp.db: full schema + the two sentinel (null
-- object walk-in) parties. Contains NO items, documents, stock or demo data.
--
-- Regenerate:  GEN_PROD_SCHEMA=1 npx jest src/db/prod-schema.test.ts
-- Source:      src/db/prod-schema.ts  (derived from src/db/ddl.ts + sentinels.ts)

-- ========================================================================
-- erp.db  (the main application database)
-- ========================================================================

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
      balance INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      balance INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS transactions (
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
  doc_id TEXT,
  note TEXT,
  attachments TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  title TEXT NOT NULL,
  category TEXT,
  total_amount INTEGER NOT NULL,
  incurred_at INTEGER NOT NULL,
  party_name TEXT,
  note TEXT,
  attachments TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_incurred ON expenses(incurred_at);

CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(ref_kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account);
CREATE INDEX IF NOT EXISTS idx_tx_doc ON transactions(doc_id);

CREATE INDEX IF NOT EXISTS idx_docs_party ON documents(party_id, kind, status);

-- Sentinel parties — REQUIRED integrity rows (documents.party_id is never null).

INSERT OR IGNORE INTO suppliers (id, created_at, updated_at, deleted_at, name, phone, is_system)
VALUES ('system-walkin-supplier', 0, 0, NULL, 'نقدي (بدون مورد)', NULL, 1);
INSERT OR IGNORE INTO customers (id, created_at, updated_at, deleted_at, name, phone, is_system)
VALUES ('system-walkin-customer', 0, 0, NULL, 'نقدي (بدون زبون)', NULL, 1);

-- ========================================================================
-- attachments.db  (SEPARATE FILE — receipt/proof BLOBs; apply to attachments.db,
-- NOT erp.db). At runtime this is created by initAttachmentsDb() on its own file.
-- ========================================================================

CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      bytes BLOB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_att_doc ON attachments(document_id);
