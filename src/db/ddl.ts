// SHARED DDL — the one place a table's SQL is written down.
//
// Migrations here are HAND-WRITTEN (there is no drizzle-generated migrations
// folder and never has been), which means the boot DDL in `migrate.ts` and the
// test DDL in `testing/test-db.ts` are two copies of the same truth and can
// drift apart. Drift is invisible: the tests keep passing against a schema the
// phone does not have.
//
// So a table whose SQL matters is written ONCE, here, and both sides import it.
// This module must stay PURE — no `expo-sqlite` import, no db client — because
// `migrate.ts` cannot be loaded under jest (it pulls in the native module) and
// the idempotency test has to be able to run the statements itself.
//
// Every statement is `IF NOT EXISTS`: `runMigrations()` fires on EVERY app boot.

/**
 * The EXPENSES table — rent, electricity, repairs.
 *
 * There is deliberately NO `paid` / `settled` column. An expense's debt is
 * `total_amount − Σ transactions WHERE ref_kind='expense' AND ref_id=E`, the
 * exact rule that derives supplier debt from purchase invoices. Rent is debt
 * too: it is an obligation with no goods, no lines and no document, and a stored
 * paid-flag would be a second, drift-prone concept for the same idea.
 *
 * `party_name` is FREE TEXT, not a supplier FK. The landlord sells the shop
 * nothing; putting him in `suppliers` would pollute the list the owner buys
 * from, and would invite him into supplier debt figures where he does not belong.
 */
export const EXPENSES_DDL = `
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
`;

/**
 * THE CASH BOOK — every movement of money, in or out.
 *
 * The two CHECK constraints are the point, not decoration. `amount` is ALWAYS
 * POSITIVE and the sign lives in `direction`; enforcing that at the SQL layer is
 * what makes a bad payment write FAIL INSIDE `documentRepository.create()`'s
 * transaction and roll the document and its lines back with it (TC-2.2). Copy
 * this table by hand into a second file and the copy without the CHECKs is the
 * one the phone will run.
 *
 * `doc_id` is PROVENANCE, NOT ALLOCATION: set only on rows born with a document,
 * so `remove()` can take them down with it (see schema.ts). The FIFO walk ignores
 * it entirely.
 *
 * `ref_kind` is 'supplier' | 'expense' | 'sale' | 'owner' | 'transfer' | 'other'
 * | 'opening' — and NO CHECK constraint, deliberately: an upgraded phone already
 * holds rows written by an older build, and a CHECK added here would be enforced
 * on every future write while the old rows sit there un-validated, so the kinds
 * are policed in TypeScript (TxRefKind) where the whole union is visible at once.
 *
 * 'opening' SETTLES DEBT WITHOUT MOVING MONEY — the only kind excluded from the
 * cash book (balances / listForCashBook / netBetween). It is how the owner says
 * "these invoices from before the app existed were already paid", and it needs no
 * column of its own: it is a `ref_kind`, not a new table. See schema.ts.
 *
 * TABLE and INDEXES are separate exports on purpose. On an upgraded install the
 * table already exists WITHOUT `doc_id`, and `CREATE INDEX ... ON transactions(doc_id)`
 * would throw "no such column" — so the boot path must run the table, then the
 * ADD COLUMN back-fill, and only THEN the indexes. Fusing them back into one
 * string re-breaks every phone that already has data on it.
 */
export const TRANSACTIONS_DDL = `
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
`;

/** Run AFTER `TRANSACTIONS_DDL` + the `doc_id` back-fill. See above. */
export const TRANSACTIONS_INDEXES_DDL = `
CREATE INDEX IF NOT EXISTS idx_tx_ref ON transactions(ref_kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account);
CREATE INDEX IF NOT EXISTS idx_tx_doc ON transactions(doc_id);
`;

/**
 * THE CORE SCHEMA — items, documents, document_lines, stock_levels, the two
 * party tables, categories and tags — plus the two line indexes.
 *
 * This used to be an inline `sqlite.execSync(...)` blob inside `migrate.ts`. It
 * moved here so it is a value the prod-schema generator can import (migrate.ts
 * pulls in expo-sqlite and cannot be loaded off-device), WITHOUT forking the
 * schema: `runMigrations()` still runs this exact string, so the .sql artifact
 * and the phone can never drift. Every statement is `IF NOT EXISTS` — it fires
 * on every boot. The columns are the FULL current shape; the ADD COLUMN
 * back-fills in migrate.ts exist only to bring OLD installs up to this shape, so
 * a fresh DB built from CORE_DDL alone already has every column and needs none
 * of them.
 */
export const CORE_DDL = `
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
`;

/**
 * The documents party index. Run LAST — after the `party_id` back-fill has added
 * the column on upgraded installs. Split from CORE_DDL for the same table-then-
 * column-then-index reason the transactions indexes are split out above.
 */
export const DOCS_PARTY_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_docs_party ON documents(party_id, kind, status);
`;

/**
 * THE VOICE NOTES table — the capture-now / process-later buffer in front of the
 * documents feature. Metadata ONLY: the audio bytes live on the filesystem
 * (Paths.document/voice-notes/), and `file_path` points at them, so this table
 * stays lean and never holds a BLOB. Every statement is `IF NOT EXISTS` — it
 * fires on every boot. The `idx_voice_status` index backs the review list, which
 * filters by status (default: pending) and orders newest-first.
 */
export const VOICE_NOTES_DDL = `
CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  file_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  linked_document_id TEXT,
  processed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_voice_status ON voice_notes(status, created_at);
`;

/**
 * The ATTACHMENTS table — receipt/proof BLOBs. Lives in a SEPARATE database file
 * (attachments.db), not erp.db, so the hot ERP tables stay lean. The constant
 * lives here so `attachments-client.ts` (which imports expo-sqlite) and the
 * prod-schema generator share one definition.
 */
export const ATTACHMENTS_DDL = `
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
`;
