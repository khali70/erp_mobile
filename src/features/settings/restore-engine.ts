import {
  DROP_MERGED_ARTIFACTS_SQL,
  BACKUP_META_TABLE,
  extractAttachmentsSql,
  parseBackupMeta,
  readBackupZip,
  restoreTargetsFor,
  type BackupFormat,
  type BackupMeta,
  type RestoreTarget,
} from './backup-format';
import {
  SQLITE_MAGIC_LENGTH,
  isSqliteHeader,
  needsForwardMigration,
  validateCandidate,
  walSidecarPaths,
  type RestoreFailureCode,
} from './restore-validation';

/**
 * RESTORE — the ORCHESTRATION, and the single most destructive action in the
 * app. It replaces the owner's live databases with a file they picked. There is
 * no server copy to fall back on, so every trap `backup.ts` documents is here
 * again in reverse, plus the ones that only exist on the way in.
 *
 * WHY THIS MODULE HAS NO IMPORTS FROM `expo-*`
 * -------------------------------------------
 * Everything below is expressed against the `RestoreIo` port at the bottom of
 * this comment: paths, bytes, connections, the boot marker. `./restore-io`
 * binds it to expo-file-system/expo-sqlite for the phone; the test suite binds
 * it to `node:fs` + better-sqlite3 and drives the REAL sequence — the real
 * snapshots, the real swap, the real rollback, the real migration pass. The
 * destructive half of a backup feature cannot be signed off on a mock, and the
 * only way to run it in Node was to stop it from importing the phone.
 *
 * THE ORDER IS THE WHOLE DESIGN, and is not negotiable:
 *
 *   validate → safety-snapshot → close handles → clear WAL → copy → migrate → restart
 *
 *  1. VALIDATE on a STAGED COPY, in the databases directory under a
 *     `restore-candidate-` name. Nothing whatsoever touches a live path until
 *     the owner has seen what is in the file and confirmed. A picked file may be
 *     a JPEG, a zip of holiday photos, someone else's SQLite database, one of
 *     our formats in the wrong slot, or a backup from a NEWER build (refused —
 *     forward-only migrations cannot undo a future column).
 *
 *  2. SAFETY SNAPSHOT of every live database this restore will touch — a
 *     checkpoint + copy into cache with a `pre-restore-` prefix, taken BEFORE
 *     any handle closes. It is the only rollback source there is, and for a zip
 *     or a merged file it covers BOTH databases: a rollback that put the ledger
 *     back but not the receipts would leave the two halves describing different
 *     moments in the shop's history.
 *
 *  3. CLOSE the live handles first. Copying over an OPEN SQLite file is how you
 *     get a database that is corrupt in a way that surfaces days later: the
 *     connection keeps its own cached pages and a WAL that no longer describes
 *     the bytes underneath it.
 *
 *  4. DELETE THE SIDECARS. `erp.db` runs in WAL mode (`enableChangeListener`),
 *     so `erp.db-wal`/`erp.db-shm` always flank it. A stale WAL beside a NEW
 *     main file makes SQLite replay pages belonging to different content —
 *     silent corruption, plausible-looking wrong reads.
 *
 *  5. COPY, then MIGRATE the promoted file through the REAL migration path, so a
 *     backup from an older build gains the columns this build expects. A failure
 *     anywhere past step 3 rolls EVERY snapshot back before it throws.
 *
 *  6. RESTART. Not an afterthought: the live handles are closed and every
 *     hydrated store and cached query in the process points at bytes that no
 *     longer exist.
 *
 * THE FOUR ACCEPTED FORMATS, one live pair of databases:
 *
 *   `zip`         — the current backup. Both databases are unpacked into staging,
 *                   validated separately, and promoted together.
 *   `merged`      — one `.db` carrying ledger + receipts + marker, written by a
 *                   shipped build. The ledger is promoted, then the payload is
 *                   SPLIT back out into `attachments.db` and the backup-only
 *                   artifacts are dropped, so the live ledger ends up in exactly
 *                   the shape a never-restored one has.
 *   `erp`         — a bare ledger `.db`. Restores the ledger alone and WARNS
 *                   that receipt images may be missing.
 *   `attachments` — a bare receipts `.db`.
 *
 * COSTING: after a restore the WAC state is whatever the restored file says it
 * is. Nothing here recomputes, patches or "repairs" it — a restore that quietly
 * rewrites the owner's cost history is not a restore.
 */

// ---------------------------------------------------------------------------
// THE PORT
// ---------------------------------------------------------------------------

/** A connection to ONE database file. */
export type RestoreDb = {
  exec(sql: string): Promise<void>;
  all<T>(sql: string): Promise<T[]>;
  first<T>(sql: string): Promise<T | null>;
  close(): Promise<void>;
};

/**
 * Everything this module needs from the outside world. Deliberately dumb: each
 * method is one filesystem or SQLite call with no decisions in it, so the part
 * that is untested on the phone is the part that has nothing to get wrong.
 */
export type RestoreIo = {
  now(): number;
  /** Absolute path of a LIVE database. */
  livePath(target: RestoreTarget): string;
  /** Absolute path inside the databases directory (staging lives here). */
  stagePath(fileName: string): string;
  /** Absolute path inside the cache directory (safety snapshots live here). */
  cachePath(fileName: string): string;

  exists(path: string): boolean;
  size(path: string): number;
  /** The WHOLE file. Only used on a picked zip, which must be read to unpack. */
  readBytes(path: string): Uint8Array;
  /** The first `length` bytes, WITHOUT reading the rest of the file. */
  readHeader(path: string, length: number): Uint8Array;
  writeBytes(path: string, bytes: Uint8Array): void;
  copyFile(from: string, to: string): void;
  /** Missing files are not an error. */
  removeFile(path: string): void;
  availableDiskSpace(): number;

  /** `PRAGMA wal_checkpoint(TRUNCATE)` on the live handle. */
  checkpointLive(target: RestoreTarget): Promise<void>;
  closeLive(target: RestoreTarget): Promise<void>;
  /** A FRESH connection to an arbitrary file. */
  openDb(path: string): Promise<RestoreDb>;
  /**
   * The app's REAL migration pass over the live file, on a connection this
   * method owns end to end. It owns the connection because the migration wants a
   * full database handle, not this port's four methods — and because two open
   * connections to the same file mid-restore is exactly the state the whole
   * close-then-copy discipline exists to avoid.
   */
  migrateErp(): Promise<void>;
  migrateAttachments(): Promise<void>;

  readMarker(): string | null;
  writeMarker(value: string): void;
  clearMarker(): void;
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/** What the picker handed back. */
export type PickedBackupFile = {
  path: string;
  name: string;
  size: number | null;
};

/** What the owner is shown before they confirm. */
export type RestorePreview = {
  /** The slot the owner chose, which validation has confirmed the file matches. */
  format: BackupFormat;
  fileName: string;
  fileSize: number;
  isValidSqlite: boolean;
  schemaOk: boolean;
  /** `PRAGMA user_version` of the ledger in the file (0 for pre-versioning). */
  userVersion: number;
  /** Whether this build must migrate the file forward after the swap. */
  needsMigration: boolean;
  /** When a merged backup was written, from its marker. Null otherwise. */
  createdAt: number | null;
  /** False for a ledger-only file, or a zip that carried no receipts. */
  hasAttachments: boolean;
  /** Ledger figures — zeroes for an attachments-only file. */
  counts: {
    documents: number;
    items: number;
    parties: number;
    attachments: number;
  };
  /**
   * Internal — the validated staged file per live database. Carried on the
   * preview so the confirm step promotes the EXACT files it inspected, never
   * re-reading the picker's result.
   */
  stagedPaths: Partial<Record<RestoreTarget, string>>;
};

export type RestoreResult = {
  restored: RestoreTarget[];
  rollbackAvailable: boolean;
  requiresRestart: true;
};

/** Defined in ./restore-validation so the pure message mapper can read it. */
export type RestoreErrorCode = RestoreFailureCode;

/** A typed failure — the UI maps `code` to a specific, actionable sentence. */
export class RestoreError extends Error {
  readonly code: RestoreErrorCode;
  /** For `wrong-slot`: the format the picked file actually is. */
  readonly actualFormat?: BackupFormat;
  readonly fileVersion?: number;

  constructor(
    code: RestoreErrorCode,
    details?: { actualFormat?: BackupFormat; fileVersion?: number },
  ) {
    super(code);
    this.name = 'RestoreError';
    this.code = code;
    this.actualFormat = details?.actualFormat;
    this.fileVersion = details?.fileVersion;
  }
}

/** One live database, its pre-restore snapshot, and where it belongs. */
export type RestoreMarkerEntry = {
  target: RestoreTarget;
  /** Path of the pre-restore safety snapshot — the rollback source. */
  snapshotPath: string;
  /** Path of the live database being replaced. */
  livePath: string;
};

/**
 * Written BEFORE the first destructive byte and cleared only on success. Its
 * presence at boot means the process died mid-swap and a live file may be half
 * written — the app offers the snapshots back rather than booting onto it.
 */
export type RestoreMarker = {
  format: BackupFormat;
  /**
   * EVERY database this restore touches. A zip or a merged file has two entries;
   * that is the whole reason this is a list — rolling back only the ledger would
   * leave the receipts describing a history that no longer exists.
   */
  entries: RestoreMarkerEntry[];
  startedAt: number;
};

// ---------------------------------------------------------------------------
// STAGING
// ---------------------------------------------------------------------------

/**
 * Staged files live in the DATABASES directory, not cache: `openDatabase` opens
 * files there by name, and promotion stays a same-volume copy — no
 * cross-filesystem surprise in the middle of the swap.
 *
 * One name per live database, plus one for a merged file (which is a ledger
 * until it has been taken apart). All three are cleared before every inspection
 * and after every outcome, so a declined candidate never lingers on disk.
 */
const STAGED_LEDGER = 'restore-candidate-erp.db';
const STAGED_ATTACHMENTS = 'restore-candidate-attachments.db';
const STAGED_MERGED = 'restore-candidate-merged.db';
const ALL_STAGED = [STAGED_LEDGER, STAGED_ATTACHMENTS, STAGED_MERGED];

/** Delete a database file and every WAL/journal sidecar beside it. */
function removeWithSidecars(io: RestoreIo, path: string): void {
  io.removeFile(path);
  dropSidecars(io, path);
}

/** Drop every staged candidate. Safe at any time; used before and after. */
export function clearStaging(io: RestoreIo): void {
  for (const name of ALL_STAGED) removeWithSidecars(io, io.stagePath(name));
}

/** The staged candidate(s) the owner declined. */
export function discardStagedCandidate(io: RestoreIo): void {
  clearStaging(io);
}

// ---------------------------------------------------------------------------
// 1. INSPECT — on staged copies, never on a live path
// ---------------------------------------------------------------------------

type CandidateFactsRead = {
  header: Uint8Array;
  tables: string[];
  meta: BackupMeta | null;
  userVersion: number;
};

/**
 * Open a staged file, run `work`, then checkpoint, close and delete the
 * sidecars — so what may be promoted in a moment is ONE self-contained main
 * file. Opening a WAL-mode database creates sidecars even for a pure read;
 * leaving them behind is how a stale WAL ends up beside a restored database.
 */
async function withStagedDb<T>(
  io: RestoreIo,
  path: string,
  work: (db: RestoreDb) => Promise<T>,
): Promise<T> {
  const db = await io.openDb(path);
  try {
    return await work(db);
  } finally {
    try {
      await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // A rejected candidate may not be checkpointable. It is being deleted.
    }
    await db.close();
    dropSidecars(io, path);
  }
}

/** Everything `validateCandidate` needs, read off one staged file. */
async function readFacts(io: RestoreIo, path: string, db: RestoreDb): Promise<CandidateFactsRead> {
  const tables = (
    await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table';")
  ).map((r) => r.name);

  // The marker table is only queried when `sqlite_master` says it exists —
  // asking blind would throw on the majority of legitimate files.
  let meta: BackupMeta | null = null;
  if (tables.includes(BACKUP_META_TABLE)) {
    try {
      meta = parseBackupMeta(
        await db.all<{ key: string; value: string }>(
          `SELECT key, value FROM ${BACKUP_META_TABLE};`,
        ),
      );
    } catch {
      // A `backup_meta` table of some other shape is not our marker.
      meta = null;
    }
  }

  const versionRow = await db.first<{ user_version: number }>('PRAGMA user_version;');
  return {
    header: io.readHeader(path, SQLITE_MAGIC_LENGTH),
    tables,
    meta,
    userVersion: versionRow?.user_version ?? 0,
  };
}

/**
 * Validate ONE staged database file against the format it is supposed to be.
 * Throws a typed `RestoreError`; the live databases are untouched on every path.
 */
async function validateStaged(
  io: RestoreIo,
  path: string,
  slot: BackupFormat,
): Promise<CandidateFactsRead> {
  // Header FIRST, off the file itself — the cheapest possible rejection, and a
  // JPEG never reaches SQLite at all.
  const header = io.readHeader(path, SQLITE_MAGIC_LENGTH);
  if (!isSqliteHeader(header)) throw new RestoreError('not-sqlite');

  let facts: CandidateFactsRead;
  try {
    facts = await withStagedDb(io, path, (db) => readFacts(io, path, db));
  } catch {
    // Past the magic check and STILL unreadable: a truncated or half-written
    // backup. Not this app's schema, as far as anything here can tell.
    throw new RestoreError('unknown-schema');
  }

  const rejection = validateCandidate({ slot, ...facts });
  if (rejection) {
    throw new RestoreError(rejection.code, {
      actualFormat: rejection.actualFormat,
      fileVersion: rejection.fileVersion,
    });
  }
  return facts;
}

const countOne = async (db: RestoreDb, sql: string): Promise<number> =>
  (await db.first<{ c: number }>(sql))?.c ?? 0;

/**
 * The figures on the confirm sheet ("this backup contains 412 documents…").
 * Raw SQL rather than a repository ON PURPOSE: every repository is bound to the
 * live singleton, and the entire point of this probe is that it runs against the
 * CANDIDATE, which is not a live database and never will be unless the owner
 * confirms. Soft-deleted rows are excluded, as they are everywhere.
 */
async function ledgerCounts(db: RestoreDb): Promise<Omit<RestorePreview['counts'], 'attachments'>> {
  return {
    documents: await countOne(db, 'SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL;'),
    items: await countOne(db, 'SELECT COUNT(*) AS c FROM items WHERE deleted_at IS NULL;'),
    parties: await countOne(
      db,
      'SELECT (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) + ' +
        '(SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL) AS c;',
    ),
  };
}

/** COUNT(*) touches row headers, not the blobs — no receipt bytes are read. */
const attachmentCount = (db: RestoreDb): Promise<number> =>
  countOne(db, 'SELECT COUNT(*) AS c FROM attachments;');

/**
 * Stage the picked file and inspect it. Throws `RestoreError` with a specific
 * code; the live databases are untouched on every path out of this function.
 */
export async function inspectCandidate(
  io: RestoreIo,
  slot: BackupFormat,
  picked: PickedBackupFile,
): Promise<RestorePreview> {
  if (!io.exists(picked.path)) throw new RestoreError('file-missing');
  clearStaging(io); // a previous, abandoned inspection

  try {
    return slot === 'zip' ? await inspectZip(io, picked) : await inspectDatabase(io, slot, picked);
  } catch (e) {
    // Nothing of ours survives a rejected candidate.
    clearStaging(io);
    throw e instanceof RestoreError ? e : new RestoreError('unknown');
  }
}

async function inspectZip(io: RestoreIo, picked: PickedBackupFile): Promise<RestorePreview> {
  const contents = readBackupZip(io.readBytes(picked.path));
  if (typeof contents === 'string') throw new RestoreError(contents);

  const ledgerPath = io.stagePath(STAGED_LEDGER);
  io.writeBytes(ledgerPath, contents.erp);

  // An `erp.db` entry that is not this app's ledger is the same problem as no
  // `erp.db` at all — the archive does not contain the owner's books.
  let facts: CandidateFactsRead;
  try {
    facts = await validateStaged(io, ledgerPath, 'erp');
  } catch (e) {
    if (e instanceof RestoreError && (e.code === 'wrong-slot' || e.code === 'not-sqlite')) {
      throw new RestoreError('zip-missing-ledger');
    }
    throw e;
  }

  const counts = {
    ...(await withStagedDb(io, ledgerPath, ledgerCounts)),
    attachments: 0,
  };

  let attachmentsPath: string | undefined;
  if (contents.attachments) {
    attachmentsPath = io.stagePath(STAGED_ATTACHMENTS);
    io.writeBytes(attachmentsPath, contents.attachments);
    // Validated in its own right. A corrupt receipts half fails the WHOLE
    // restore rather than being quietly dropped: the owner asked for their
    // photos back, and half a backup restored silently is a lie.
    await validateStaged(io, attachmentsPath, 'attachments');
    counts.attachments = await withStagedDb(io, attachmentsPath, attachmentCount);
  }

  return {
    format: 'zip',
    fileName: picked.name,
    fileSize: picked.size ?? io.size(picked.path),
    isValidSqlite: true,
    schemaOk: true,
    userVersion: facts.userVersion,
    needsMigration: needsForwardMigration(facts.userVersion),
    createdAt: null,
    hasAttachments: attachmentsPath !== undefined,
    counts,
    stagedPaths: {
      erp: ledgerPath,
      ...(attachmentsPath ? { attachments: attachmentsPath } : {}),
    },
  };
}

async function inspectDatabase(
  io: RestoreIo,
  slot: Exclude<BackupFormat, 'zip'>,
  picked: PickedBackupFile,
): Promise<RestorePreview> {
  const stagedName =
    slot === 'merged' ? STAGED_MERGED : slot === 'erp' ? STAGED_LEDGER : STAGED_ATTACHMENTS;
  const stagedPath = io.stagePath(stagedName);
  io.copyFile(picked.path, stagedPath);

  const facts = await validateStaged(io, stagedPath, slot);
  const hasLedger = slot !== 'attachments';
  const hasAttachments = slot !== 'erp';

  const counts = await withStagedDb(io, stagedPath, async (db) => ({
    ...(hasLedger ? await ledgerCounts(db) : { documents: 0, items: 0, parties: 0 }),
    attachments: hasAttachments ? await attachmentCount(db) : 0,
  }));

  return {
    format: slot,
    fileName: picked.name,
    fileSize: picked.size ?? io.size(stagedPath),
    isValidSqlite: true,
    schemaOk: true,
    userVersion: facts.userVersion,
    needsMigration: needsForwardMigration(facts.userVersion),
    createdAt: facts.meta?.createdAt ?? null,
    hasAttachments,
    counts,
    // A merged file is promoted ONTO the ledger; its receipts are split out of
    // it afterwards, which is why it has no attachments entry here.
    stagedPaths: slot === 'attachments' ? { attachments: stagedPath } : { erp: stagedPath },
  };
}

// ---------------------------------------------------------------------------
// 2. THE SWAP
// ---------------------------------------------------------------------------

/**
 * Replace the live database(s) with the validated staged file(s).
 *
 * Callers MUST have gone through `inspectCandidate()` and an explicit owner
 * confirmation first. On return the live handles are CLOSED — nothing may read
 * them again in this process, which is why the result demands a restart.
 */
export async function applyRestore(io: RestoreIo, preview: RestorePreview): Promise<RestoreResult> {
  const { format, stagedPaths } = preview;
  const staged = Object.entries(stagedPaths) as [RestoreTarget, string][];
  if (staged.length === 0) throw new RestoreError('file-missing');
  for (const [, path] of staged) {
    if (!io.exists(path)) throw new RestoreError('file-missing');
  }

  const targets = restoreTargetsFor(format, preview.hasAttachments);

  // Fail EARLY on a full disk: the safety snapshots are full second copies of
  // the live databases, and a restore whose rollback source could not be written
  // is not a restore worth starting.
  const liveBytes = targets.reduce((sum, t) => sum + io.size(io.livePath(t)), 0);
  const stagedBytes = staged.reduce((sum, [, path]) => sum + io.size(path), 0);
  if (io.availableDiskSpace() < liveBytes + stagedBytes) throw new RestoreError('no-space');

  // (2) SAFETY SNAPSHOTS — checkpoint + copy, for every database this restore
  // will touch, BEFORE any of them close.
  const stamp = new Date(io.now()).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const entries: RestoreMarkerEntry[] = [];
  for (const target of targets) {
    await io.checkpointLive(target);
    const snapshotPath = io.cachePath(`pre-restore-${target}-${stamp}.db`);
    io.removeFile(snapshotPath);
    io.copyFile(io.livePath(target), snapshotPath);
    entries.push({ target, snapshotPath, livePath: io.livePath(target) });
  }

  // The point of no return. Everything past here is recoverable only from the
  // marker and the snapshots above.
  io.writeMarker(
    JSON.stringify({
      format,
      entries,
      startedAt: io.now(),
    } satisfies RestoreMarker),
  );

  try {
    // (3) CLOSE every live handle, (4) drop THEIR sidecars, (5) promote.
    for (const target of targets) {
      await io.closeLive(target);
      removeWithSidecars(io, io.livePath(target));
    }
    for (const [target, path] of staged) {
      io.copyFile(path, io.livePath(target));
    }
  } catch {
    // Nothing was written yet, or only partially — put the snapshots back. The
    // staged copies go too: they are a second copy of the owner's entire
    // database, and a failed restore does not get to leave one lying next to the
    // live files until the next attempt happens to overwrite it.
    await rollbackEntries(io, entries);
    io.clearMarker();
    clearStaging(io);
    throw new RestoreError('copy-failed');
  }

  // (5b) MIGRATE forward, split a merged payload out, drop the artifacts.
  try {
    await finishRestore(io, format, targets);
  } catch {
    await rollbackEntries(io, entries);
    io.clearMarker();
    clearStaging(io);
    throw new RestoreError('migrate-failed');
  }

  io.clearMarker();
  clearStaging(io);
  return { restored: targets, rollbackAvailable: true, requiresRestart: true };
}

/**
 * Everything that has to happen to the promoted file(s) before the app may be
 * restarted onto them — on FRESH connections, because the singletons were closed
 * for the swap and must stay closed. Reopening one would hand the rest of the
 * app a handle onto a database it has already cached stale pages for.
 *
 * For a merged file the order is load-bearing:
 *   ledger migrated → payload copied OUT into attachments.db → artifacts dropped.
 * Dropping first would throw the receipts away; copying after the drop would copy
 * nothing. Both mistakes are silent.
 */
async function finishRestore(
  io: RestoreIo,
  format: BackupFormat,
  targets: readonly RestoreTarget[],
): Promise<void> {
  if (targets.includes('erp')) {
    await io.migrateErp();
    dropSidecars(io, io.livePath('erp'));
  }

  if (format === 'merged') {
    // SPLIT: a brand-new attachments.db (the old one was deleted in the swap),
    // bootstrapped and then filled from the ledger's merged-in payload. The two
    // steps run on separate connections, one after the other — never both open.
    await io.migrateAttachments();
    dropSidecars(io, io.livePath('attachments'));
    await withFreshLive(io, 'attachments', (db) =>
      db.exec(extractAttachmentsSql(io.livePath('erp'))),
    );
    // The payload and the marker are BACKUP artifacts, not ledger data.
    await withFreshLive(io, 'erp', async (db) => {
      await db.exec(DROP_MERGED_ARTIFACTS_SQL);
      try {
        // Reclaim the pages the dropped blobs occupied. Best-effort: VACUUM
        // needs temp space, and a ledger merely larger than it needs to be is
        // still a correct ledger.
        await db.exec('VACUUM;');
      } catch {
        // Not fatal. See above.
      }
    });
    return;
  }

  if (targets.includes('attachments')) {
    await io.migrateAttachments();
    dropSidecars(io, io.livePath('attachments'));
  }
}

/** No `-wal`/`-shm`/`-journal` may outlive the connection that made it. */
function dropSidecars(io: RestoreIo, path: string): void {
  for (const sidecar of walSidecarPaths(path)) io.removeFile(sidecar);
}

/**
 * Open a live database on a fresh connection, run `work`, then checkpoint, close
 * and delete the sidecars — so no `-wal`/`-shm` is left for the next launch to
 * inherit beside a file it did not come from.
 */
async function withFreshLive(
  io: RestoreIo,
  target: RestoreTarget,
  work: (db: RestoreDb) => Promise<void> | void,
): Promise<void> {
  const path = io.livePath(target);
  const db = await io.openDb(path);
  try {
    await work(db);
    await db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    await db.close();
    dropSidecars(io, path);
  }
}

/** Put every `pre-restore-` snapshot back over its live path. */
async function rollbackEntries(
  io: RestoreIo,
  entries: readonly RestoreMarkerEntry[],
): Promise<void> {
  for (const entry of entries) {
    // Nothing better to do for this one; the marker stays for the boot gate.
    if (!io.exists(entry.snapshotPath)) continue;
    removeWithSidecars(io, entry.livePath);
    io.copyFile(entry.snapshotPath, entry.livePath);
  }
}

// ---------------------------------------------------------------------------
// 3. INTERRUPTED-RESTORE RECOVERY (next launch)
// ---------------------------------------------------------------------------

/**
 * A restore that never finished — read at boot, BEFORE migrations run. A marker
 * here means the process was killed (or storage filled) between closing a live
 * handle and finishing the copy, so a file at a live path may be half written.
 * Booting the app onto it would either crash on first read or, worse, not crash.
 */
export function detectInterruptedRestore(io: RestoreIo): RestoreMarker | null {
  const raw = io.readMarker();
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as RestoreMarker;
    if (!Array.isArray(marker?.entries) || marker.entries.length === 0) return null;
    if (marker.entries.some((e) => !e?.snapshotPath || !e?.livePath || !e?.target)) return null;
    return marker;
  } catch {
    return null;
  }
}

/**
 * Are the snapshots this marker points at still on disk? Cache can be evicted,
 * and a PARTIAL rollback is worse than none — for a two-database restore both
 * halves must be recoverable or neither is offered.
 */
export function isRollbackAvailable(io: RestoreIo, marker: RestoreMarker): boolean {
  return marker.entries.every((entry) => io.exists(entry.snapshotPath));
}

/**
 * Roll the interrupted restore back to its pre-restore snapshots — ALL of them.
 * Closes the live handles first (they were opened by the module imports at boot,
 * onto whatever bytes survived), so a restart is required afterwards exactly as
 * after a restore.
 */
export async function rollbackInterruptedRestore(
  io: RestoreIo,
  marker: RestoreMarker,
): Promise<void> {
  if (!isRollbackAvailable(io, marker)) throw new RestoreError('file-missing');
  for (const entry of marker.entries) await io.closeLive(entry.target);
  await rollbackEntries(io, marker.entries);
  io.clearMarker();
}

/** Keep whatever is on disk and boot normally. The owner's call, not ours. */
export function discardInterruptedRestore(io: RestoreIo): void {
  io.clearMarker();
}
