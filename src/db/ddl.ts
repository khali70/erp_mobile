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
