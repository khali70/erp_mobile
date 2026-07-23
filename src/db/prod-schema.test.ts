import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { buildErpSchemaSql, buildProdSchemaSql } from './prod-schema';
import { WALKIN_CUSTOMER_ID, WALKIN_SUPPLIER_ID } from './sentinels';

// prod-schema.sql is a DERIVED artifact. This test is its generator AND its
// guard:
//   • `GEN_PROD_SCHEMA=1 npx jest src/db/prod-schema.test.ts` rewrites the file.
//   • plain `npm test` asserts the committed file still equals what the current
//     DDL constants produce — so an edit to ddl.ts/sentinels.ts that is not
//     regenerated FAILS here, which is what keeps the .sql in lockstep.
// It also proves the artifact provisions the right database: full schema, the two
// sentinel rows, and NOTHING else.

const SQL_PATH = join(__dirname, 'prod-schema.sql');

const tableNames = (db: Database.Database) =>
  (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as { name: string }[]
  ).map((r) => r.name);

describe('prod-schema.sql generation', () => {
  it('regenerates the committed artifact (write under GEN_PROD_SCHEMA, else drift-guard)', () => {
    const generated = buildProdSchemaSql();

    // Test-only regeneration toggle — NOT app config (the AGENTS.md env rule is
    // about runtime config in src/config/env.ts; this never ships).
    // eslint-disable-next-line no-restricted-properties
    if (process.env.GEN_PROD_SCHEMA) {
      writeFileSync(SQL_PATH, generated, 'utf8');
    }

    const committed = readFileSync(SQL_PATH, 'utf8');
    // If this fails: the DDL changed but prod-schema.sql was not regenerated.
    expect(committed).toBe(generated);
  });
});

describe('prod-schema.sql provisions a clean production erp.db', () => {
  const provision = () => {
    const db = new Database(':memory:');
    db.exec(buildErpSchemaSql());
    return db;
  };

  it('creates the full schema and re-running it is a silent no-op (idempotent)', () => {
    const db = provision();
    expect(() => db.exec(buildErpSchemaSql())).not.toThrow(); // the app re-runs runMigrations() over it

    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        'items',
        'documents',
        'document_lines',
        'stock_levels',
        'customers',
        'suppliers',
        'categories',
        'tags',
        'transactions',
        'expenses',
      ]),
    );
  });

  it('holds EXACTLY the two sentinel rows and no other party/business data', () => {
    const db = provision();

    const suppliers = db.prepare('SELECT id, is_system FROM suppliers').all() as {
      id: string;
      is_system: number;
    }[];
    const customers = db.prepare('SELECT id, is_system FROM customers').all() as {
      id: string;
      is_system: number;
    }[];

    expect(suppliers).toEqual([{ id: WALKIN_SUPPLIER_ID, is_system: 1 }]);
    expect(customers).toEqual([{ id: WALKIN_CUSTOMER_ID, is_system: 1 }]);

    // The acceptance criterion: zero dummy data. Every business table is empty.
    for (const t of ['items', 'documents', 'document_lines', 'stock_levels']) {
      const { c } = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
      expect(c).toBe(0);
    }
  });

  it('re-seeding the sentinels over the provisioned db is INSERT OR IGNORE (no dupes)', () => {
    const db = provision();
    db.exec(buildErpSchemaSql()); // includes the sentinel INSERT OR IGNOREs again

    const { c: sc } = db.prepare('SELECT COUNT(*) AS c FROM suppliers').get() as { c: number };
    const { c: cc } = db.prepare('SELECT COUNT(*) AS c FROM customers').get() as { c: number };
    expect(sc).toBe(1);
    expect(cc).toBe(1);
  });
});
