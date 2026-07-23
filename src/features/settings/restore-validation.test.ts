import { APP_SCHEMA_VERSION } from '@/db/schema-version';
import {
  BACKUP_META_TABLE,
  MERGED_BACKUP_FORMAT,
  MERGED_BACKUP_FORMAT_VERSION,
  type BackupMeta,
} from './backup-format';
import {
  SQLITE_MAGIC,
  isPreFlightFailure,
  isSqliteHeader,
  needsForwardMigration,
  validateCandidate,
  walSidecarPaths,
} from './restore-validation';

/** The real 16-byte header every SQLite file starts with. */
function sqliteHeader(): Uint8Array {
  return new Uint8Array([...SQLITE_MAGIC].map((c) => c.charCodeAt(0)));
}

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
const ATTACHMENT_TABLES = ['attachments'];

const mergedMeta = (over: Partial<BackupMeta> = {}): BackupMeta => ({
  format: MERGED_BACKUP_FORMAT,
  formatVersion: MERGED_BACKUP_FORMAT_VERSION,
  appSchemaVersion: APP_SCHEMA_VERSION,
  createdAt: 1_770_000_000_000,
  attachmentCount: 3,
  ...over,
});

describe('isSqliteHeader', () => {
  it('accepts a real SQLite header', () => {
    expect(isSqliteHeader(sqliteHeader())).toBe(true);
  });

  it('rejects a JPEG', () => {
    expect(
      isSqliteHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
    ).toBe(false);
  });

  it('rejects a ZIP', () => {
    const zip = new Uint8Array(16);
    zip.set([0x50, 0x4b, 0x03, 0x04]);
    expect(isSqliteHeader(zip)).toBe(false);
  });

  it('rejects a truncated file whose bytes match as far as they go', () => {
    expect(isSqliteHeader(sqliteHeader().slice(0, 8))).toBe(false);
  });

  it('rejects the header without its terminating NUL (a text file that says so)', () => {
    const spaced = sqliteHeader();
    spaced[15] = 0x20; // ' ' instead of NUL
    expect(isSqliteHeader(spaced)).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(isSqliteHeader(new Uint8Array(0))).toBe(false);
  });
});

describe('validateCandidate', () => {
  const base = { header: sqliteHeader(), userVersion: APP_SCHEMA_VERSION };

  it('accepts a merged backup in the merged slot', () => {
    expect(
      validateCandidate({ ...base, slot: 'merged', tables: MERGED_TABLES, meta: mergedMeta() }),
    ).toBeNull();
  });

  it('accepts a LEGACY bare ledger — owners still have these on disk', () => {
    expect(validateCandidate({ ...base, slot: 'erp', tables: LEDGER_TABLES, meta: null })).toBeNull();
  });

  it('accepts a LEGACY bare attachments file', () => {
    expect(
      validateCandidate({ ...base, slot: 'attachments', tables: ATTACHMENT_TABLES, meta: null }),
    ).toBeNull();
  });

  it('accepts an OLDER backup (user_version 0, pre-versioning)', () => {
    expect(
      validateCandidate({ ...base, slot: 'erp', tables: LEDGER_TABLES, meta: null, userVersion: 0 }),
    ).toBeNull();
  });

  it('rejects a non-SQLite file before anything else', () => {
    expect(
      validateCandidate({
        ...base,
        header: new Uint8Array(16),
        slot: 'merged',
        tables: MERGED_TABLES,
        meta: mergedMeta(),
      }),
    ).toEqual({ code: 'not-sqlite' });
  });

  it('rejects a foreign schema', () => {
    expect(validateCandidate({ ...base, slot: 'erp', tables: ['messages'], meta: null })).toEqual({
      code: 'unknown-schema',
    });
  });

  it('names the format when a merged backup is picked in a legacy slot', () => {
    expect(
      validateCandidate({ ...base, slot: 'erp', tables: MERGED_TABLES, meta: mergedMeta() }),
    ).toEqual({ code: 'wrong-slot', actualFormat: 'merged' });
  });

  it('names the format when a legacy ledger is picked as a full backup', () => {
    expect(validateCandidate({ ...base, slot: 'merged', tables: LEDGER_TABLES, meta: null })).toEqual(
      { code: 'wrong-slot', actualFormat: 'erp' },
    );
  });

  it('names the format when the receipts file is picked as a full backup', () => {
    expect(
      validateCandidate({ ...base, slot: 'merged', tables: ATTACHMENT_TABLES, meta: null }),
    ).toEqual({ code: 'wrong-slot', actualFormat: 'attachments' });
  });

  it('REFUSES a backup whose SCHEMA is newer — a downgrade would corrupt data', () => {
    expect(
      validateCandidate({
        ...base,
        slot: 'erp',
        tables: LEDGER_TABLES,
        meta: null,
        userVersion: APP_SCHEMA_VERSION + 1,
      }),
    ).toEqual({
      code: 'schema-too-new',
      fileVersion: APP_SCHEMA_VERSION + 1,
      appVersion: APP_SCHEMA_VERSION,
    });
  });

  it('REFUSES a merged FORMAT written by a newer build, before the shape check', () => {
    expect(
      validateCandidate({
        ...base,
        slot: 'merged',
        tables: MERGED_TABLES,
        meta: mergedMeta({ formatVersion: MERGED_BACKUP_FORMAT_VERSION + 1 }),
      }),
    ).toEqual({
      code: 'schema-too-new',
      fileVersion: MERGED_BACKUP_FORMAT_VERSION + 1,
      appVersion: APP_SCHEMA_VERSION,
    });
  });

  it('checks the file bytes before the schema — a JPEG is never "wrong slot"', () => {
    expect(
      validateCandidate({
        header: new Uint8Array([0xff, 0xd8]),
        slot: 'attachments',
        tables: LEDGER_TABLES,
        meta: null,
        userVersion: 99,
      })?.code,
    ).toBe('not-sqlite');
  });
});

describe('isPreFlightFailure', () => {
  it('is true for every rejection raised before the live DB is touched', () => {
    for (const code of ['not-sqlite', 'unknown-schema', 'wrong-slot', 'schema-too-new'] as const) {
      expect(isPreFlightFailure(code)).toBe(true);
    }
  });

  it('is false for a failure that happened mid-swap and was rolled back', () => {
    expect(isPreFlightFailure('copy-failed')).toBe(false);
    expect(isPreFlightFailure('migrate-failed')).toBe(false);
  });
});

describe('needsForwardMigration', () => {
  it('is true for a pre-versioning backup', () => {
    expect(needsForwardMigration(0, 1)).toBe(true);
  });

  it('is false at the current version', () => {
    expect(needsForwardMigration(1, 1)).toBe(false);
  });
});

describe('walSidecarPaths', () => {
  it('lists every sidecar that must be deleted beside the restored file', () => {
    expect(walSidecarPaths('/data/app/SQLite/erp.db')).toEqual([
      '/data/app/SQLite/erp.db-wal',
      '/data/app/SQLite/erp.db-shm',
      '/data/app/SQLite/erp.db-journal',
    ]);
  });

  it('keeps the file:// scheme it was given', () => {
    expect(walSidecarPaths('file:///x/attachments.db')[0]).toBe('file:///x/attachments.db-wal');
  });
});
