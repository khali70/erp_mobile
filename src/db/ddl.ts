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
