import {
  ATTACHMENTS_REQUIRED_TABLES,
  ERP_REQUIRED_TABLES,
  SQLITE_MAGIC,
  detectTarget,
  isSqliteHeader,
  needsForwardMigration,
  validateCandidate,
  walSidecarPaths,
} from './restore-validation';
import { APP_SCHEMA_VERSION } from '@/db/schema-version';

/** The real 16-byte header every SQLite file starts with. */
function sqliteHeader(): Uint8Array {
  return new Uint8Array([...SQLITE_MAGIC].map((c) => c.charCodeAt(0)));
}

const ERP_TABLES = [...ERP_REQUIRED_TABLES, 'transactions', 'expenses', 'categories', 'tags'];
const ATTACHMENT_TABLES = [...ATTACHMENTS_REQUIRED_TABLES];

describe('isSqliteHeader', () => {
  it('accepts a real SQLite header', () => {
    expect(isSqliteHeader(sqliteHeader())).toBe(true);
  });

  it('rejects a JPEG', () => {
    expect(isSqliteHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      false,
    );
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

describe('detectTarget', () => {
  it('recognises the ledger', () => {
    expect(detectTarget(ERP_TABLES)).toBe('erp');
  });

  it('recognises the attachments DB', () => {
    expect(detectTarget(ATTACHMENT_TABLES)).toBe('attachments');
  });

  it('rejects a foreign SQLite schema', () => {
    expect(detectTarget(['messages', 'chats', 'android_metadata'])).toBeNull();
  });

  it('rejects a ledger missing a core table', () => {
    expect(detectTarget(ERP_TABLES.filter((t) => t !== 'document_lines'))).toBeNull();
  });
});

describe('validateCandidate', () => {
  const base = { header: sqliteHeader(), userVersion: APP_SCHEMA_VERSION };

  it('accepts a matching ledger backup', () => {
    expect(validateCandidate({ ...base, target: 'erp', tables: ERP_TABLES })).toBeNull();
  });

  it('accepts a matching attachments backup', () => {
    expect(
      validateCandidate({ ...base, target: 'attachments', tables: ATTACHMENT_TABLES }),
    ).toBeNull();
  });

  it('accepts an OLDER ledger backup (user_version 0, pre-versioning)', () => {
    expect(
      validateCandidate({ ...base, target: 'erp', tables: ERP_TABLES, userVersion: 0 }),
    ).toBeNull();
  });

  it('rejects a non-SQLite file before anything else', () => {
    const result = validateCandidate({
      ...base,
      header: new Uint8Array(16),
      target: 'erp',
      tables: ERP_TABLES,
    });
    expect(result).toEqual({ code: 'not-sqlite' });
  });

  it('rejects a foreign schema', () => {
    expect(validateCandidate({ ...base, target: 'erp', tables: ['messages'] })).toEqual({
      code: 'unknown-schema',
    });
  });

  it('names the correct slot when the attachments file is picked as the ledger', () => {
    expect(validateCandidate({ ...base, target: 'erp', tables: ATTACHMENT_TABLES })).toEqual({
      code: 'wrong-slot',
      actualTarget: 'attachments',
    });
  });

  it('names the correct slot when the ledger is picked as the attachments file', () => {
    expect(validateCandidate({ ...base, target: 'attachments', tables: ERP_TABLES })).toEqual({
      code: 'wrong-slot',
      actualTarget: 'erp',
    });
  });

  it('REFUSES a backup written by a newer build — a downgrade would corrupt data', () => {
    expect(
      validateCandidate({
        ...base,
        target: 'erp',
        tables: ERP_TABLES,
        userVersion: APP_SCHEMA_VERSION + 1,
      }),
    ).toEqual({
      code: 'schema-too-new',
      fileVersion: APP_SCHEMA_VERSION + 1,
      appVersion: APP_SCHEMA_VERSION,
    });
  });

  it('checks the file bytes before the schema — a JPEG is never "wrong slot"', () => {
    const result = validateCandidate({
      header: new Uint8Array([0xff, 0xd8]),
      target: 'attachments',
      tables: ERP_TABLES,
      userVersion: 99,
    });
    expect(result?.code).toBe('not-sqlite');
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
