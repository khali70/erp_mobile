import Database from 'better-sqlite3';
import { EXPENSES_DDL } from './ddl';

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
