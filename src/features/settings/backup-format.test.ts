import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  ATTACHMENTS_DDL,
  CORE_DDL,
  DOCS_PARTY_INDEX_DDL,
  EXPENSES_DDL,
  TRANSACTIONS_DDL,
  TRANSACTIONS_INDEXES_DDL,
} from '@/db/ddl';
import { APP_SCHEMA_VERSION } from '@/db/schema-version';
import { unzipSync, zipSync } from 'fflate';
import {
  BACKUP_META_TABLE,
  DROP_MERGED_ARTIFACTS_SQL,
  MAX_BACKUP_BYTES,
  MERGED_BACKUP_FORMAT,
  MERGED_BACKUP_FORMAT_VERSION,
  ZIP_ENTRY_ATTACHMENTS,
  ZIP_ENTRY_ERP,
  buildBackupZip,
  detectBackupFormat,
  exceedsBackupSizeLimit,
  extractAttachmentsSql,
  isBackupFormatTooNew,
  isZipHeader,
  parseBackupMeta,
  readBackupZip,
  restoreTargetsFor,
  sqlQuote,
  type BackupMeta,
} from './backup-format';

/**
 * MERGED-FORMAT NOTE: nothing in the app writes a merged `.db` any more — the
 * backup artifact is a zip. The merge SQL below therefore lives HERE, in the
 * test, and the fixtures it builds stand in for the files already on owners'
 * devices. That is the honest shape for these tests: they prove restore can take
 * apart a file it did not create.
 */
const MERGE_INTO_LEDGER_SQL = (attachmentsPath: string) =>
  [
    `ATTACH DATABASE ${sqlQuote(attachmentsPath)} AS att;`,
    'DROP TABLE IF EXISTS main.attachments;',
    ATTACHMENTS_DDL,
    'INSERT INTO main.attachments SELECT * FROM att.attachments;',
    'DETACH DATABASE att;',
  ].join('\n');

const WRITE_META_SQL = (attachmentCount: number, formatVersion = MERGED_BACKUP_FORMAT_VERSION) =>
  `
CREATE TABLE IF NOT EXISTS ${BACKUP_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR REPLACE INTO ${BACKUP_META_TABLE} (key, value) VALUES
  ('format', ${sqlQuote(MERGED_BACKUP_FORMAT)}),
  ('format_version', ${sqlQuote(String(formatVersion))}),
  ('app_schema_version', ${sqlQuote(String(APP_SCHEMA_VERSION))}),
  ('created_at', '123'),
  ('attachment_count', ${sqlQuote(String(attachmentCount))});
`;

// ---------------------------------------------------------------------------
// The COLLISION check the merge design rests on.
// ---------------------------------------------------------------------------

/** Every `CREATE TABLE [IF NOT EXISTS] <name>` in a DDL string. */
function tablesDeclaredIn(ddl: string): string[] {
  return [...ddl.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
}

describe('merged-file collision safety', () => {
  const ledgerTables = [
    CORE_DDL,
    TRANSACTIONS_DDL,
    EXPENSES_DDL,
    TRANSACTIONS_INDEXES_DDL,
    DOCS_PARTY_INDEX_DDL,
  ].flatMap(tablesDeclaredIn);

  it('the ledger declares NO table named `attachments` — so the payload cannot collide', () => {
    expect(ledgerTables).not.toContain('attachments');
  });

  it('`documents.attachments` / `expenses.attachments` are COLUMNS, not tables', () => {
    // The whole merge is safe because of this distinction; if a future migration
    // ever promoted either column to a table, this test fails before a backup
    // silently overwrites it.
    expect(CORE_DDL).toMatch(/documents \([^)]*attachments TEXT/s);
    expect(EXPENSES_DDL).toMatch(/attachments TEXT/);
    expect(ledgerTables).toContain('documents');
    expect(ledgerTables).toContain('expenses');
  });

  it('the ledger declares no `backup_meta` table either', () => {
    expect(ledgerTables).not.toContain(BACKUP_META_TABLE);
  });

  it('the attachments database is exactly one table', () => {
    expect(tablesDeclaredIn(ATTACHMENTS_DDL)).toEqual(['attachments']);
  });
});

// ---------------------------------------------------------------------------
// The MARKER.
// ---------------------------------------------------------------------------

describe('backup meta marker', () => {
  it('is read back from a REAL merged file, by value', () => {
    const db = new Database(':memory:');
    db.exec(WRITE_META_SQL(42));
    const rows = db.prepare(`SELECT key, value FROM ${BACKUP_META_TABLE};`).all() as {
      key: string;
      value: string;
    }[];
    db.close();
    expect(parseBackupMeta(rows).format).toBe(MERGED_BACKUP_FORMAT);
    expect(parseBackupMeta(rows).attachmentCount).toBe(42);
  });

  it('survives missing and garbage rows', () => {
    expect(parseBackupMeta([])).toEqual({
      format: null,
      formatVersion: null,
      appSchemaVersion: null,
      createdAt: null,
      attachmentCount: null,
    });
    expect(parseBackupMeta([{ key: 'created_at', value: 'yesterday' }]).createdAt).toBeNull();
  });

  it('escapes quotes rather than letting them terminate the literal', () => {
    expect(sqlQuote("O'Brien")).toBe("'O''Brien'");
  });
});

// ---------------------------------------------------------------------------
// FORMAT DETECTION — merged by marker, legacy by shape.
// ---------------------------------------------------------------------------

const LEDGER_TABLES = [
  'items',
  'documents',
  'document_lines',
  'stock_levels',
  'customers',
  'suppliers',
  'transactions',
  'expenses',
];
const MERGED_TABLES = [...LEDGER_TABLES, 'attachments', BACKUP_META_TABLE];

const meta = (over: Partial<BackupMeta> = {}): BackupMeta => ({
  format: MERGED_BACKUP_FORMAT,
  formatVersion: MERGED_BACKUP_FORMAT_VERSION,
  appSchemaVersion: APP_SCHEMA_VERSION,
  createdAt: 1_770_000_000_000,
  attachmentCount: 3,
  ...over,
});

describe('detectBackupFormat', () => {
  it('recognises a merged backup by its declared marker', () => {
    expect(detectBackupFormat(MERGED_TABLES, meta())).toBe('merged');
  });

  it('still recognises a LEGACY bare ledger', () => {
    expect(detectBackupFormat(LEDGER_TABLES, null)).toBe('erp');
  });

  it('still recognises a LEGACY bare attachments file', () => {
    expect(detectBackupFormat(['attachments'], null)).toBe('attachments');
  });

  it('does NOT call a file merged on table presence alone', () => {
    // Same tables, no marker row: a ledger that happens to carry an attachments
    // table is not a merged backup, and guessing would restore it wrongly.
    expect(detectBackupFormat(MERGED_TABLES, null)).toBe('erp');
    expect(detectBackupFormat(MERGED_TABLES, meta({ format: 'something-else' }))).toBe('erp');
  });

  it('does not call a file merged when the payload table is missing', () => {
    expect(detectBackupFormat(LEDGER_TABLES.concat(BACKUP_META_TABLE), meta())).toBe('erp');
  });

  it('rejects a foreign SQLite schema', () => {
    expect(detectBackupFormat(['messages', 'chats', 'android_metadata'], null)).toBeNull();
  });

  it('rejects a ledger missing a core table', () => {
    expect(
      detectBackupFormat(
        LEDGER_TABLES.filter((t) => t !== 'document_lines'),
        null,
      ),
    ).toBeNull();
  });
});

describe('isBackupFormatTooNew', () => {
  it('refuses a merged layout from a future build', () => {
    expect(isBackupFormatTooNew(meta({ formatVersion: MERGED_BACKUP_FORMAT_VERSION + 1 }))).toBe(
      true,
    );
  });

  it('accepts the current and older layouts', () => {
    expect(isBackupFormatTooNew(meta())).toBe(false);
    expect(isBackupFormatTooNew(meta({ formatVersion: 0 }))).toBe(false);
  });

  it('ignores a marker that is not ours', () => {
    expect(isBackupFormatTooNew(meta({ format: 'other', formatVersion: 99 }))).toBe(false);
    expect(isBackupFormatTooNew(null)).toBe(false);
  });
});

describe('restoreTargetsFor', () => {
  it('a zip or a merged file replaces BOTH databases — both snapshotted, both rolled back', () => {
    expect(restoreTargetsFor('zip')).toEqual(['erp', 'attachments']);
    expect(restoreTargetsFor('merged')).toEqual(['erp', 'attachments']);
  });

  it('a zip with no receipts in it leaves the receipts database alone', () => {
    expect(restoreTargetsFor('zip', false)).toEqual(['erp']);
  });

  it('a single-database file replaces exactly one', () => {
    expect(restoreTargetsFor('erp')).toEqual(['erp']);
    expect(restoreTargetsFor('attachments')).toEqual(['attachments']);
  });
});

// ---------------------------------------------------------------------------
// THE ZIP — the artifact backup writes today, through real fflate.
// ---------------------------------------------------------------------------

describe('backup archive', () => {
  const erp = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const attachments = new Uint8Array([9, 8, 7, 6]);

  it('holds both databases under the names restore looks for', () => {
    const entries = unzipSync(buildBackupZip(erp, attachments));
    expect(Object.keys(entries).sort()).toEqual([ZIP_ENTRY_ATTACHMENTS, ZIP_ENTRY_ERP]);
  });

  it('round-trips both payloads byte for byte', () => {
    const read = readBackupZip(buildBackupZip(erp, attachments));
    expect(typeof read).not.toBe('string');
    const contents = read as {
      erp: Uint8Array;
      attachments: Uint8Array | null;
    };
    expect([...contents.erp]).toEqual([...erp]);
    expect([...(contents.attachments as Uint8Array)]).toEqual([...attachments]);
  });

  it('round-trips a payload that does not compress — a receipt photo is already compressed', () => {
    // Pseudo-random bytes stand in for JPEG data: this is the case the low
    // compression level is chosen for, and it must survive exactly.
    const noise = new Uint8Array(4096);
    for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 37 + 11) % 251;
    const read = readBackupZip(buildBackupZip(erp, noise)) as {
      attachments: Uint8Array;
    };
    expect(Buffer.from(read.attachments).equals(Buffer.from(noise))).toBe(true);
  });

  it('says NOT-A-ZIP for anything without a PK signature', () => {
    expect(readBackupZip(new Uint8Array([0x53, 0x51, 0x4c, 0x69]))).toBe('not-zip');
    expect(readBackupZip(new Uint8Array([]))).toBe('not-zip');
    expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(true); // empty archive
    expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x99, 0x99]))).toBe(false);
  });

  it('says NOT-A-ZIP for a PK header on corrupt bytes', () => {
    const truncated = buildBackupZip(erp, attachments).slice(0, 12);
    expect(readBackupZip(truncated)).toBe('not-zip');
  });

  it('says MISSING-LEDGER for a real archive with no erp.db in it', () => {
    expect(readBackupZip(zipSync({ [ZIP_ENTRY_ATTACHMENTS]: attachments }))).toBe(
      'zip-missing-ledger',
    );
    expect(readBackupZip(zipSync({ 'holiday.jpg': attachments }))).toBe('zip-missing-ledger');
  });

  it('accepts an archive with no receipts entry — a shop may have no photos yet', () => {
    const read = readBackupZip(zipSync({ [ZIP_ENTRY_ERP]: erp })) as {
      attachments: Uint8Array | null;
    };
    expect(read.attachments).toBeNull();
  });
});

describe('size ceiling', () => {
  it('refuses only past the documented limit', () => {
    expect(exceedsBackupSizeLimit(MAX_BACKUP_BYTES)).toBe(false);
    expect(exceedsBackupSizeLimit(MAX_BACKUP_BYTES + 1)).toBe(true);
    expect(exceedsBackupSizeLimit(0)).toBe(false);
  });

  it('is measured on the COMBINED snapshots, since both are held in memory at once', () => {
    expect(exceedsBackupSizeLimit(6, 10)).toBe(false);
    expect(exceedsBackupSizeLimit(6 + 5, 10)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The MERGE and the SPLIT, run for real against SQLite.
// ---------------------------------------------------------------------------

describe('merged-file split (real SQLite)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-backup-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** A ledger-shaped database, as `snapshot()` would have produced. */
  function makeLedger(file: string): void {
    const db = new Database(file);
    db.exec(CORE_DDL);
    db.exec(TRANSACTIONS_DDL);
    db.exec(EXPENSES_DDL);
    db.prepare(
      "INSERT INTO items (id, created_at, updated_at, name) VALUES ('i1', 0, 0, 'شاي');",
    ).run();
    db.close();
  }

  /** An attachments database holding two receipt blobs. */
  function makeAttachments(file: string): void {
    const db = new Database(file);
    db.exec(ATTACHMENTS_DDL);
    const insert = db.prepare(
      'INSERT INTO attachments (id, document_id, name, mime, size, created_at, bytes) VALUES (?, ?, ?, ?, ?, ?, ?);',
    );
    insert.run('a1', 'd1', 'receipt.jpg', 'image/jpeg', 4, 1, Buffer.from([1, 2, 3, 4]));
    insert.run('a2', 'd2', 'invoice.pdf', 'application/pdf', 2, 2, Buffer.from([9, 9]));
    db.close();
  }

  it('folds the receipt bytes into the ledger and takes them back out unchanged', () => {
    const ledger = path.join(dir, 'erp-backup.db');
    const attachments = path.join(dir, 'attachments.db');
    makeLedger(ledger);
    makeAttachments(attachments);

    // ---- BACKUP: merge + declare, exactly as backup.ts runs it.
    const merged = new Database(ledger);
    merged.exec(MERGE_INTO_LEDGER_SQL(attachments));
    const count = (
      merged.prepare('SELECT COUNT(*) AS c FROM attachments;').get() as {
        c: number;
      }
    ).c;
    merged.exec(WRITE_META_SQL(count));
    merged.close();

    // The merged file now detects as `merged`, and the ORIGINAL attachments file
    // is untouched (the merge only ever SELECTs from it).
    const check = new Database(ledger);
    const tables = (
      check.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    const metaRows = check.prepare(`SELECT key, value FROM ${BACKUP_META_TABLE};`).all() as {
      key: string;
      value: string;
    }[];
    check.close();
    expect(count).toBe(2);
    expect(detectBackupFormat(tables, parseBackupMeta(metaRows))).toBe('merged');

    // ---- RESTORE: split the payload back into a fresh attachments database.
    const restoredAttachments = path.join(dir, 'restored-attachments.db');
    const target = new Database(restoredAttachments);
    target.exec(ATTACHMENTS_DDL);
    target.exec(extractAttachmentsSql(ledger));
    const rows = target
      .prepare(
        'SELECT id, document_id, name, mime, size, created_at, bytes FROM attachments ORDER BY id;',
      )
      .all() as { id: string; name: string; bytes: Buffer }[];
    target.close();

    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2']);
    expect([...rows[0].bytes]).toEqual([1, 2, 3, 4]);
    expect([...rows[1].bytes]).toEqual([9, 9]);

    // ---- And the restored LEDGER drops the backup-only artifacts, so it ends
    // up in exactly the shape a never-restored ledger has.
    const cleaned = new Database(ledger);
    cleaned.exec(DROP_MERGED_ARTIFACTS_SQL);
    const after = (
      cleaned.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    const itemsSurvived = (
      cleaned.prepare('SELECT COUNT(*) AS c FROM items;').get() as {
        c: number;
      }
    ).c;
    cleaned.close();

    expect(after).not.toContain('attachments');
    expect(after).not.toContain(BACKUP_META_TABLE);
    expect(after).toContain('documents');
    expect(itemsSurvived).toBe(1);
    expect(detectBackupFormat(after, null)).toBe('erp');
  });

  it('the split is idempotent — re-running it does not duplicate receipts', () => {
    const ledger = path.join(dir, 'erp-backup.db');
    const attachments = path.join(dir, 'attachments.db');
    makeLedger(ledger);
    makeAttachments(attachments);

    const merged = new Database(ledger);
    merged.exec(MERGE_INTO_LEDGER_SQL(attachments));
    merged.close();

    const restored = path.join(dir, 'restored.db');
    const target = new Database(restored);
    target.exec(ATTACHMENTS_DDL);
    target.exec(extractAttachmentsSql(ledger));
    target.exec(extractAttachmentsSql(ledger));
    const c = (
      target.prepare('SELECT COUNT(*) AS c FROM attachments;').get() as {
        c: number;
      }
    ).c;
    target.close();
    expect(c).toBe(2);
  });

  it('merging twice does not duplicate the payload either', () => {
    const ledger = path.join(dir, 'erp-backup.db');
    const attachments = path.join(dir, 'attachments.db');
    makeLedger(ledger);
    makeAttachments(attachments);

    const db = new Database(ledger);
    db.exec(MERGE_INTO_LEDGER_SQL(attachments));
    db.exec(MERGE_INTO_LEDGER_SQL(attachments));
    const c = (
      db.prepare('SELECT COUNT(*) AS c FROM attachments;').get() as {
        c: number;
      }
    ).c;
    db.close();
    expect(c).toBe(2);
  });

  it('an empty attachments database still produces a valid merged backup', () => {
    const ledger = path.join(dir, 'erp-backup.db');
    const attachments = path.join(dir, 'attachments.db');
    makeLedger(ledger);
    const empty = new Database(attachments);
    empty.exec(ATTACHMENTS_DDL);
    empty.close();

    const db = new Database(ledger);
    db.exec(MERGE_INTO_LEDGER_SQL(attachments));
    db.exec(WRITE_META_SQL(0));
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as { name: string }[]
    ).map((r) => r.name);
    const rows = db.prepare(`SELECT key, value FROM ${BACKUP_META_TABLE};`).all() as {
      key: string;
      value: string;
    }[];
    db.close();
    expect(detectBackupFormat(tables, parseBackupMeta(rows))).toBe('merged');
  });
});
