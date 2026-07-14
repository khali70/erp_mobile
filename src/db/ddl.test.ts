import Database from 'better-sqlite3';
import { EXPENSES_DDL, TRANSACTIONS_DDL, TRANSACTIONS_INDEXES_DDL } from './ddl';

// `runMigrations()` fires on EVERY app boot — there is no version table and no
// "have I run yet?" flag. So the DDL is not merely expected to be idempotent: it
// is RUN twice, three times, a hundred times over a phone's life, and the second
// run must be a silent no-op over a table that already holds the owner's rent.
//
// migrate.ts itself cannot be imported here (it pulls in expo-sqlite, a native
// module with no node build), which is exactly why the SQL lives in ./ddl — the
// statements the phone runs are the statements this test runs.

const tables = (sqlite: Database.Database, name: string) =>
  sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .all(name) as { name: string }[];

describe('the expenses migration is IDEMPOTENT', () => {
  it('running it twice creates ONE table — no duplicate, no throw', () => {
    const sqlite = new Database(':memory:');

    sqlite.exec(EXPENSES_DDL);
    expect(() => sqlite.exec(EXPENSES_DDL)).not.toThrow(); // the second boot

    expect(tables(sqlite, 'expenses')).toHaveLength(1);

    const indexes = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'expenses'`)
      .all() as { name: string }[];
    expect(indexes.filter((i) => i.name === 'idx_expenses_incurred')).toHaveLength(1);
  });

  it('re-running it over a POPULATED table does not touch a single row', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(EXPENSES_DDL);
    sqlite
      .prepare(
        `INSERT INTO expenses (id, created_at, updated_at, deleted_at, title, category,
           total_amount, incurred_at, party_name, note, attachments)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .run('e1', 1, 1, 'إيجار المحل', 'rent', 20000, 1, 'الحاج مصطفى');

    sqlite.exec(EXPENSES_DDL); // reboot the app

    const rows = sqlite.prepare('SELECT * FROM expenses').all() as { total_amount: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].total_amount).toBe(20000); // the rent survived the boot
  });

  it('has NO paid/settled column — an expense cannot store what it was paid', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(EXPENSES_DDL);

    const cols = (sqlite.prepare(`PRAGMA table_info(expenses)`).all() as { name: string }[]).map(
      (c) => c.name,
    );

    // The whole design in one assertion: debt is DERIVED from the transactions
    // pointing at this row, never stored on it. A `paid` column would be a second
    // answer to a question the cash book already answers.
    expect(cols).not.toContain('paid');
    expect(cols).not.toContain('settled');
    expect(cols).not.toContain('balance');
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'created_at',
        'updated_at',
        'deleted_at',
        'title',
        'category',
        'total_amount',
        'incurred_at',
        'party_name',
        'note',
        'attachments',
      ]),
    );
  });
});

// The CASH BOOK's SQL used to be hand-copied into migrate.ts AND test-db.ts —
// two copies of the table whose CHECK constraints are the only thing making a
// bad payment roll its document back. Now it is written once, here, so this
// test covers the SQL the PHONE actually runs.
describe('the transactions DDL', () => {
  const boot = (sqlite: Database.Database) => {
    sqlite.exec(TRANSACTIONS_DDL);
    sqlite.exec(TRANSACTIONS_INDEXES_DDL);
  };

  it('is IDEMPOTENT — every boot re-runs it over the owner\'s cash book', () => {
    const sqlite = new Database(':memory:');

    boot(sqlite);
    expect(() => boot(sqlite)).not.toThrow(); // the second boot

    const tbls = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`)
      .all();
    expect(tbls).toHaveLength(1);
  });

  it('keeps the CHECK constraints that roll a bad payment back (TC-2.2)', () => {
    const sqlite = new Database(':memory:');
    boot(sqlite);

    const insert = (direction: number, amount: number) =>
      sqlite
        .prepare(
          `INSERT INTO transactions (id, created_at, updated_at, direction, amount, occurred_at, account)
           VALUES ('x', 1, 1, ?, ?, 1, 'cash')`,
        )
        .run(direction, amount);

    // The sign lives in `direction`; `amount` is a magnitude. Both are enforced
    // in SQL, not merely in JS — that is what makes a bad payment insert fail
    // INSIDE documentRepository.create()'s transaction and take the document
    // and its lines down with it.
    expect(() => insert(-1, -500)).toThrow(); // amount must be > 0
    expect(() => insert(0, 500)).toThrow(); // direction must be ±1
    expect(() => insert(-1, 500)).not.toThrow();
  });

  it('carries doc_id — the provenance column remove() cascades on — plus its index', () => {
    const sqlite = new Database(':memory:');
    boot(sqlite);

    const cols = (
      sqlite.prepare(`PRAGMA table_info(transactions)`).all() as { name: string }[]
    ).map((c) => c.name);
    expect(cols).toContain('doc_id');

    // Without this index, cascading a document's money rows on delete scans the
    // whole cash book.
    const indexes = (
      sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transactions'`)
        .all() as { name: string }[]
    ).map((i) => i.name);
    expect(indexes).toEqual(
      expect.arrayContaining(['idx_tx_ref', 'idx_tx_occurred', 'idx_tx_account', 'idx_tx_doc']),
    );
  });

  it('has NO allocation column — doc_id is provenance, and the walk never reads it', () => {
    const sqlite = new Database(':memory:');
    boot(sqlite);

    const cols = (
      sqlite.prepare(`PRAGMA table_info(transactions)`).all() as { name: string }[]
    ).map((c) => c.name);

    // The design in one assertion. A payment points at the SUPPLIER (ref_id) and
    // the invoice-level breakdown is DERIVED by walking FIFO at read time. An
    // `invoice_id` / `allocated_amount` here would be a second answer to a
    // question the walk already answers, and the two would drift.
    expect(cols).not.toContain('invoice_id');
    expect(cols).not.toContain('allocated_amount');
    expect(cols).not.toContain('settled');
  });
});
