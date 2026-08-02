import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/db/schema';
import { applyAttachmentsSchema, applyErpSchema } from '@/db/migrate-core';
import type { SentinelDb } from '@/db/sentinels';
import { BACKUP_META_TABLE, MERGED_BACKUP_FORMAT, sqlQuote } from '../backup-format';
import type { RestoreDb, RestoreIo } from '../restore-engine';

/**
 * A `RestoreIo` backed by `node:fs` and better-sqlite3, so the restore engine
 * can be driven END TO END in the node suite: real files, real snapshots, real
 * WAL sidecars, the real migration pass, a real rollback. Restore is the
 * destructive half of this feature and the half with no undo — it does not get
 * to be verified against mocks.
 *
 * TEST-ONLY. Never imported by app code.
 */

export type Harness = {
  io: RestoreIo;
  root: string;
  dbDir: string;
  cacheDir: string;
  /** Where the picker's "downloads" live in these tests. */
  pickDir: string;
  livePath(target: 'erp' | 'attachments'): string;
  /** Re-open a live handle after the engine closed it, as a restart would. */
  reopenLive(): void;
  /** MMKV stand-in, survives building a second io ("next launch"). */
  marker: { value: string | null };
  /** The live voice-notes directory these tests write restored recordings into. */
  voiceDir: string;
  cleanup(): void;
  /** Fault injection: throw from the next call whose path matches. */
  failCopyInto: string | null;
  failMigrateErp: boolean;
  /** Fault injection: make every voice write throw, to prove it does NOT roll back. */
  failVoiceWrite: boolean;
  /** Every marker value seen at the moment a live file was overwritten. */
  markerDuringSwap: (string | null)[];
};

const LIVE_FILES = { erp: 'erp.db', attachments: 'attachments.db' } as const;

/** better-sqlite3 wrapped in the engine's narrow port. */
function wrap(db: Database.Database): RestoreDb {
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    all: async <T>(sql: string) => db.prepare(sql).all() as T[],
    first: async <T>(sql: string) => (db.prepare(sql).get() as T) ?? null,
    close: async () => {
      db.close();
    },
  };
}

/** The app's REAL migration pass, against a better-sqlite3 handle. */
export function migrateErpFile(file: string): void {
  const db = new Database(file);
  try {
    applyErpSchema(
      { execSync: (sql) => db.exec(sql) },
      drizzle(db, { schema }) as unknown as SentinelDb,
    );
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    db.close();
  }
}

export function migrateAttachmentsFile(file: string): void {
  const db = new Database(file);
  try {
    applyAttachmentsSchema({ execSync: (sql) => db.exec(sql) });
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    db.close();
  }
}

export function createHarness(): Harness {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const dbDir = path.join(root, 'databases');
  const cacheDir = path.join(root, 'cache');
  const pickDir = path.join(root, 'downloads');
  // The live voice dir is NOT pre-created: the engine must `ensureDir` it, just
  // as it does on a device where a shop that never recorded has no folder.
  const voiceDir = path.join(root, 'documents', 'voice-notes');
  for (const dir of [dbDir, cacheDir, pickDir]) fs.mkdirSync(dir, { recursive: true });

  const livePath = (target: 'erp' | 'attachments') => path.join(dbDir, LIVE_FILES[target]);

  // The two live handles, held open exactly as the app holds them — in WAL mode,
  // which is what puts `-wal`/`-shm` beside every live file and makes the
  // sidecar rules worth testing at all.
  const live: Record<'erp' | 'attachments', Database.Database | null> = {
    erp: null,
    attachments: null,
  };
  const openLive = (target: 'erp' | 'attachments') => {
    const db = new Database(livePath(target));
    db.pragma('journal_mode = WAL');
    live[target] = db;
  };

  const state: Harness = {
    io: null as unknown as RestoreIo,
    root,
    dbDir,
    cacheDir,
    pickDir,
    livePath,
    reopenLive: () => {
      for (const target of ['erp', 'attachments'] as const) {
        if (!live[target]) openLive(target);
      }
    },
    marker: { value: null },
    voiceDir,
    cleanup: () => {
      for (const target of ['erp', 'attachments'] as const) {
        try {
          live[target]?.close();
        } catch {
          // already closed by the engine
        }
        live[target] = null;
      }
      fs.rmSync(root, { recursive: true, force: true });
    },
    failCopyInto: null,
    failMigrateErp: false,
    failVoiceWrite: false,
    markerDuringSwap: [],
  };

  state.io = {
    now: () => 1_700_000_000_000,
    livePath,
    stagePath: (fileName) => path.join(dbDir, fileName),
    cachePath: (fileName) => path.join(cacheDir, fileName),

    exists: (p) => fs.existsSync(p),
    size: (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0),
    readBytes: (p) => new Uint8Array(fs.readFileSync(p)),
    readHeader: (p, length) => {
      try {
        const fd = fs.openSync(p, 'r');
        try {
          const buf = Buffer.alloc(length);
          const read = fs.readSync(fd, buf, 0, length, 0);
          return new Uint8Array(buf.subarray(0, read));
        } finally {
          fs.closeSync(fd);
        }
      } catch {
        return new Uint8Array(0);
      }
    },
    writeBytes: (p, bytes) => {
      // Model a device that cannot write the restored recordings (permissions,
      // full disk under the doc dir): only the voice writes fail, proving the
      // ledger swap that already completed is NOT rolled back.
      if (state.failVoiceWrite && p.startsWith(voiceDir)) {
        throw new Error('injected voice write failure');
      }
      fs.writeFileSync(p, bytes);
    },
    copyFile: (from, to) => {
      // Record what the boot gate would have seen at the exact moment a live
      // file was about to be overwritten.
      if (to === livePath('erp') || to === livePath('attachments')) {
        state.markerDuringSwap.push(state.marker.value);
      }
      if (state.failCopyInto && to === state.failCopyInto) {
        // One shot: the rollback that follows copies INTO the same path, and a
        // fault that fired twice would be testing the harness, not the engine.
        state.failCopyInto = null;
        throw new Error('injected copy failure');
      }
      fs.copyFileSync(from, to);
    },
    removeFile: (p) => {
      if (fs.existsSync(p)) fs.rmSync(p);
    },
    availableDiskSpace: () => 10 * 1024 * 1024 * 1024,

    voiceDirPath: () => voiceDir,
    ensureDir: (p) => fs.mkdirSync(p, { recursive: true }),

    checkpointLive: async (target) => {
      live[target]?.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    },
    closeLive: async (target) => {
      live[target]?.close();
      live[target] = null;
    },
    openDb: async (p) => wrap(new Database(p)),
    migrateErp: async () => {
      if (state.failMigrateErp) throw new Error('injected migration failure');
      migrateErpFile(livePath('erp'));
    },
    migrateAttachments: async () => migrateAttachmentsFile(livePath('attachments')),

    readMarker: () => state.marker.value,
    writeMarker: (value) => {
      state.marker.value = value;
    },
    clearMarker: () => {
      state.marker.value = null;
    },
  };

  return state;
}

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

export type SeedAttachment = {
  id: string;
  documentId: string;
  name: string;
  bytes: Buffer;
};

/** A ledger built by the REAL migration, with recognisable rows in it. */
export function seedLedger(file: string, opts: { documents?: number; items?: number } = {}): void {
  migrateErpFile(file);
  const db = new Database(file);
  try {
    const now = 1_700_000_000_000;
    const items = opts.items ?? 3;
    const documents = opts.documents ?? 2;
    for (let i = 0; i < items; i += 1) {
      db.prepare(
        'INSERT INTO items (id, created_at, updated_at, name, sale_price, cost_price) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(`item-${i}`, now, now, `صنف ${i}`, 1000 + i, 500 + i);
    }
    for (let i = 0; i < documents; i += 1) {
      db.prepare(
        'INSERT INTO documents (id, created_at, updated_at, kind, direction, total_amount) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(`doc-${i}`, now, now, 'sale', 1, 2500 + i);
      db.prepare(
        'INSERT INTO document_lines (id, created_at, updated_at, document_id, item_id, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(`line-${i}`, now, now, `doc-${i}`, 'item-0', 2, 1250);
    }
    db.prepare('INSERT INTO customers (id, created_at, updated_at, name) VALUES (?, ?, ?, ?)').run(
      'cust-1',
      now,
      now,
      'زبون تجريبي',
    );
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    db.close();
  }
}

/** An attachments database with real (non-text, non-compressible) blobs in it. */
export function seedAttachments(file: string, count = 3): SeedAttachment[] {
  migrateAttachmentsFile(file);
  const db = new Database(file);
  const rows: SeedAttachment[] = [];
  try {
    for (let i = 0; i < count; i += 1) {
      // Pseudo-random bytes: a real receipt photo is already-compressed noise,
      // which is exactly what must survive a zip round trip byte for byte.
      const bytes = Buffer.alloc(2048 + i);
      for (let b = 0; b < bytes.length; b += 1) bytes[b] = (b * 31 + i * 17) % 251;
      const row = {
        id: `att-${i}`,
        documentId: `doc-${i % 2}`,
        name: `receipt-${i}.jpg`,
        bytes,
      };
      db.prepare(
        'INSERT INTO attachments (id, document_id, name, mime, size, created_at, bytes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(row.id, row.documentId, row.name, 'image/jpeg', bytes.length, 1_700_000_000_000, bytes);
      rows.push(row);
    }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    db.close();
  }
  return rows;
}

/**
 * A MERGED `.db` exactly as the shipped build wrote one: ledger + an
 * `attachments` table copied across an ATTACH + a `backup_meta` marker.
 *
 * The SQL lives here, in the test, because nothing in the app writes this format
 * any more — the app only READS it. A fixture built by hand is also the honest
 * test: it proves restore can take apart a file it did not create.
 */
export function buildMergedFixture(
  target: string,
  ledgerFile: string,
  attachmentsFile: string,
  meta: { formatVersion?: number; appSchemaVersion?: number } = {},
): void {
  fs.copyFileSync(ledgerFile, target);
  const db = new Database(target);
  try {
    db.exec(`ATTACH DATABASE ${sqlQuote(attachmentsFile)} AS att;`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        bytes BLOB NOT NULL
      );
      INSERT INTO main.attachments SELECT * FROM att.attachments;
    `);
    db.exec('DETACH DATABASE att;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${BACKUP_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${BACKUP_META_TABLE} (key, value) VALUES (?, ?)`,
    );
    insert.run('format', MERGED_BACKUP_FORMAT);
    insert.run('format_version', String(meta.formatVersion ?? 1));
    insert.run('app_schema_version', String(meta.appSchemaVersion ?? 1));
    insert.run('created_at', String(1_700_000_000_000));
    insert.run(
      'attachment_count',
      String(
        (
          db.prepare('SELECT COUNT(*) AS c FROM attachments').get() as {
            c: number;
          }
        ).c,
      ),
    );
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// ASSERTION HELPERS
// ---------------------------------------------------------------------------

/** Every row of every table in a database, as comparable plain values. */
export function dumpDatabase(file: string): Record<string, unknown[]> {
  const db = new Database(file, { readonly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")
      .all() as { name: string }[];
    const out: Record<string, unknown[]> = {};
    for (const { name } of tables) {
      if (name.startsWith('sqlite_')) continue;
      out[name] = db.prepare(`SELECT * FROM "${name}";`).all() as unknown[];
    }
    return out;
  } finally {
    db.close();
  }
}

export function tableNames(file: string): string[] {
  const db = new Database(file, { readonly: true });
  try {
    return (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table';").all() as { name: string }[]
    ).map((r) => r.name);
  } finally {
    db.close();
  }
}

export function attachmentRows(file: string): { id: string; name: string; bytes: Buffer }[] {
  const db = new Database(file, { readonly: true });
  try {
    return db.prepare('SELECT id, name, bytes FROM attachments ORDER BY id;').all() as {
      id: string;
      name: string;
      bytes: Buffer;
    }[];
  } finally {
    db.close();
  }
}

/**
 * Staged/working files that should never outlive an inspection — success,
 * refusal or crash. Kept separate from sidecars because a LIVE handle is
 * legitimately allowed to have a `-wal` beside it; a candidate is not.
 */
export function stagedLeftovers(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('restore-candidate-') || name.startsWith('backup-'))
    .sort();
}

/**
 * WAL/journal sidecars in a directory. After a restore, with every handle
 * closed, there must be none: a stale `-wal` beside a replaced main file makes
 * SQLite replay pages belonging to different content.
 *
 * Call this BEFORE reading the databases back — opening a WAL-mode file, even
 * read-only, recreates its `-shm`.
 */
export function sidecarFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => /-(wal|shm|journal)$/.test(name))
    .sort();
}
