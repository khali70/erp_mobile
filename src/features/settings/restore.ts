import { BackHandler, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { File, FileMode, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { sqlite } from '@/db/client';
import { attachmentsDb, migrateAttachmentsDatabase } from '@/db/attachments-client';
import { drizzleFor, migrateErpDatabase } from '@/db/migrate';
import { storage } from '@/store/mmkv';
import { snapshot } from './backup';
import {
  BACKUP_META_TABLE,
  DROP_MERGED_ARTIFACTS_SQL,
  extractAttachmentsSql,
  parseBackupMeta,
  restoreTargetsFor,
  type BackupFormat,
  type BackupMeta,
  type RestoreTarget,
} from './backup-format';
import {
  databasesPath,
  deleteSidecars,
  deleteWithSidecars,
  toFileUri,
} from './db-files';
import {
  SQLITE_MAGIC_LENGTH,
  isSqliteHeader,
  needsForwardMigration,
  validateCandidate,
  type RestoreFailureCode,
} from './restore-validation';

/**
 * RESTORE — the inverse of ./backup, and the single most destructive action in
 * the app. It replaces the owner's live databases with a file they picked. There
 * is no server copy to fall back on, so every trap `backup.ts` documents is here
 * again, in reverse, plus the ones that only exist on the way in.
 *
 * The ORDER below is the whole design and is not negotiable:
 *
 *   validate → safety-snapshot → close handles → clear WAL → copy → migrate → restart
 *
 *  1. VALIDATE on a COPY, in the databases directory under a `restore-candidate-`
 *     name. Nothing whatsoever touches a live path until the owner has seen what
 *     is in the file and confirmed. A picked file may be a JPEG, someone else's
 *     SQLite database, one of our formats in the wrong slot, or a backup from a
 *     NEWER build (refused — forward-only migrations cannot undo a future column,
 *     so a downgrade reads a schema it does not understand).
 *
 *  2. SAFETY SNAPSHOT via backup.ts's `snapshot()` — checkpoint + copy, written
 *     to cache with a `pre-restore-` prefix. It is the only rollback source, and
 *     for a MERGED file it is taken for BOTH databases: a rollback that put the
 *     ledger back but not the receipts would leave the two halves describing
 *     different moments in the shop's history.
 *
 *  3. CLOSE the live handles first. Copying over an OPEN SQLite file is how you
 *     get a database that is corrupt in a way that surfaces days later: the
 *     connection keeps its own cached pages and a WAL that no longer describes
 *     the bytes underneath it.
 *
 *  4. DELETE THE SIDECARS. `erp.db` runs in WAL mode (`enableChangeListener`),
 *     so `erp.db-wal`/`erp.db-shm` always flank it. A stale WAL beside a NEW
 *     main file makes SQLite replay pages belonging to different content —
 *     silent corruption, plausible-looking wrong reads. See restore-validation.
 *
 *  5. COPY, then MIGRATE the restored file through the REAL migration path
 *     (`migrateErpDatabase`) on a fresh connection, so a backup from an older
 *     build gains the columns this build expects. A failure here rolls every
 *     snapshot back in place before it throws.
 *
 *  6. RESTART. Not an afterthought: by this point the live handles are CLOSED
 *     and every hydrated store and cached query in the process points at bytes
 *     that no longer exist. See `CAN_RELOAD_PROGRAMMATICALLY` below.
 *
 * THREE ACCEPTED FORMATS, one live pair of databases:
 *
 *   `merged`      — the current backup: ONE file carrying the ledger, the receipt
 *                   payload, and a `backup_meta` marker. Restored in a single
 *                   pick: the ledger is promoted, then the payload is SPLIT back
 *                   out into `attachments.db` and the backup-only artifacts are
 *                   dropped, so the live ledger ends up in exactly the shape a
 *                   normal one has.
 *   `erp`         — a legacy bare `erp-backup-*.db`. Still accepted, forever:
 *                   owners have them on disk from builds that shipped before the
 *                   merge. Restores the ledger alone and WARNS that receipt
 *                   images may be missing.
 *   `attachments` — a legacy bare `erp-attachments-*.db`.
 *
 * CONTENT-URI trap, same as backup's: the picker hands back a `content://` URI
 * on Android, and `File` needs a `file://` one. `copyToCacheDirectory: true`
 * makes the picker do that translation for us.
 *
 * COSTING: after a restore the WAC state is whatever the restored file says it
 * is. Nothing here recomputes, patches or "repairs" it — a restore that quietly
 * rewrites the owner's cost history is not a restore.
 */

export type { BackupFormat, RestoreTarget } from './backup-format';

/** What the owner is shown before they confirm. */
export type RestorePreview = {
  /** The slot the owner chose, which validation has confirmed the file matches. */
  format: BackupFormat;
  fileName: string;
  fileSize: number;
  isValidSqlite: boolean;
  schemaOk: boolean;
  /** `PRAGMA user_version` of the PICKED file (0 for pre-versioning backups). */
  userVersion: number;
  /** Whether this build must migrate the file forward after the swap. */
  needsMigration: boolean;
  /** When the merged backup was written, from its marker. Null for legacy files. */
  createdAt: number | null;
  /** Ledger figures — zeroes for an attachments-only file. */
  counts: { documents: number; items: number; parties: number; attachments: number };
  /**
   * Internal — the validated copy in the databases directory that will be
   * promoted on confirm. Carried on the preview so the confirm step swaps the
   * exact file it inspected, never re-reading the picker's result.
   */
  stagedPath: string;
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

/**
 * Whether this build can restart itself.
 *
 * `expo-updates` IS installed now, and `Updates.reloadAsync()` is the supported
 * way to restart an Expo app — but it is disabled in Expo Go and in a dev client
 * without an update URL, which is exactly where this flow gets exercised most.
 * So the capability is read at runtime rather than assumed, and every caller has
 * a fallback: the success dialog stays non-dismissible and keeps telling the
 * owner to fully close and reopen the app, which is the honest thing to show
 * when the alternative is letting screens read from a handle that was closed
 * under them.
 */
export const CAN_RELOAD_PROGRAMMATICALLY = Updates.isEnabled;

/**
 * Restart the app so nothing reads the replaced files through a stale handle.
 *
 * Three rungs, best first:
 *  1. `Updates.reloadAsync()` — tears down and rebuilds the whole RN host, which
 *     is what re-runs `openDatabaseSync` and rebuilds every hydrated store.
 *  2. Android's `exitApp()` — finishes the root activity. Cruder, but it is
 *     literally what the success copy asks the owner to do by hand.
 *  3. Nothing: iOS forbids an app from terminating itself (it reads as a crash
 *     and is an App Store rejection), so the instruction on screen is all there
 *     is. Returns false and the caller leaves the dialog up.
 *
 * Whichever rung fires, the data on disk is already correct and complete — a
 * failed restart costs the owner one manual force-close, nothing more.
 */
export async function requestAppRestart(): Promise<boolean> {
  if (Updates.isEnabled) {
    try {
      await Updates.reloadAsync();
      return true;
    } catch {
      // Disabled or unavailable at runtime — fall through to the next rung.
    }
  }
  if (Platform.OS === 'android') {
    BackHandler.exitApp();
    return true;
  }
  return false;
}

const DB_FILE: Record<RestoreTarget, string> = {
  erp: 'erp.db',
  attachments: 'attachments.db',
};

/** Staged under the databases directory so the swap is a same-volume copy. */
const STAGED_FILE: Record<BackupFormat, string> = {
  merged: 'restore-candidate-merged.db',
  erp: 'restore-candidate-erp.db',
  attachments: 'restore-candidate-attachments.db',
};

function liveHandle(target: RestoreTarget): SQLiteDatabase {
  return target === 'erp' ? sqlite : attachmentsDb;
}

function livePathFor(target: RestoreTarget): string {
  return liveHandle(target).databasePath;
}

function stagedPathFor(format: BackupFormat): string {
  return databasesPath(STAGED_FILE[format]);
}

/** The live database a staged file of this format is copied ONTO. */
function promotionTargetFor(format: BackupFormat): RestoreTarget {
  return format === 'attachments' ? 'attachments' : 'erp';
}

// ---------------------------------------------------------------------------
// 1. PICK
// ---------------------------------------------------------------------------

/**
 * Open the system document picker. Resolves to `null` when the owner backs out
 * — a cancel is a normal, silent no-op, never an error dialog.
 *
 * The ANY-type filter is on purpose: Android reports `.db` files with a mixture
 * of MIME types (`application/octet-stream`, `application/vnd.sqlite3`, or
 * nothing at all) depending on the provider, so filtering by MIME hides the very
 * file the owner is looking for. The real filter is the header + schema check.
 */
export async function pickBackupFile(): Promise<DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    // Translates Android's `content://` into a readable cache `file://`.
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

// ---------------------------------------------------------------------------
// 2. VALIDATE — on a copy, never on a live path
// ---------------------------------------------------------------------------

/**
 * Stage the picked file next to the live databases and inspect it there.
 *
 * "Read-only" here means the LIVE databases are never opened, read or touched:
 * the candidate itself has to be opened writably, because a WAL-mode file (which
 * every backup this app produces is) creates its sidecars on open. Those are
 * checkpointed and deleted again before we return, so what gets promoted is a
 * single self-contained main file.
 *
 * Throws `RestoreError` with a specific code; the live DBs are untouched on
 * every path out of this function.
 */
export async function inspectBackupFile(
  slot: BackupFormat,
  asset: DocumentPickerAsset,
): Promise<RestorePreview> {
  const source = new File(asset.uri);
  if (!source.exists) throw new RestoreError('file-missing');

  const stagedPath = stagedPathFor(slot);
  deleteWithSidecars(stagedPath); // a previous, abandoned inspection
  const staged = new File(toFileUri(stagedPath));
  source.copySync(staged);

  let header: Uint8Array = new Uint8Array(0);
  let handle: SQLiteDatabase | null = null;
  try {
    // Header first, off a file handle — `bytes()` would read the WHOLE database
    // into JS memory, and a merged backup carries every receipt photo. It is
    // also the cheapest possible rejection: a JPEG never reaches SQLite at all.
    header = readHeader(staged);
    if (!isSqliteHeader(header)) throw new RestoreError('not-sqlite');

    handle = await openDatabaseAsync(STAGED_FILE[slot], { useNewConnection: true });

    const tables = (
      await handle.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table';",
      )
    ).map((r) => r.name);
    const meta = await readBackupMeta(handle, tables);
    const versionRow = await handle.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const userVersion = versionRow?.user_version ?? 0;

    const rejection = validateCandidate({ slot, header, tables, meta, userVersion });
    if (rejection) {
      throw new RestoreError(rejection.code, {
        actualFormat: rejection.actualFormat,
        fileVersion: rejection.fileVersion,
      });
    }

    return {
      format: slot,
      fileName: asset.name,
      fileSize: asset.size ?? staged.size,
      isValidSqlite: true,
      schemaOk: true,
      userVersion,
      needsMigration: needsForwardMigration(userVersion),
      createdAt: meta?.createdAt ?? null,
      counts: await probeCounts(handle, slot),
      stagedPath,
    };
  } catch (e) {
    // Nothing of ours survives a rejected candidate — not even in cache.
    deleteWithSidecars(stagedPath);
    if (e instanceof RestoreError) throw e;
    // Past the magic check and STILL unreadable: a truncated or half-written
    // backup. Not this app's schema, as far as anything here can tell.
    throw new RestoreError(isSqliteHeader(header) ? 'unknown-schema' : 'not-sqlite');
  } finally {
    if (handle) {
      try {
        // Fold anything the open created back in and drop the sidecars, so the
        // file we may promote in a moment is one self-contained main file.
        await handle.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // A rejected candidate may not be checkpointable. It is being deleted.
      }
      await handle.closeAsync();
      deleteSidecars(stagedPath);
    }
  }
}

/**
 * The first `SQLITE_MAGIC_LENGTH` bytes, without reading the whole file. An
 * empty array for anything unreadable or shorter than the header — which the
 * caller treats as "not a SQLite file", because it is not one.
 */
function readHeader(file: File): Uint8Array {
  try {
    const fh = file.open(FileMode.ReadOnly);
    try {
      return fh.readBytes(SQLITE_MAGIC_LENGTH);
    } finally {
      fh.close();
    }
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * The candidate's self-declaration, or `null` when it carries no marker table
 * (every legacy backup, and every database that is not ours). The table is only
 * queried when `sqlite_master` says it exists — asking blind would throw on the
 * majority of legitimate files.
 */
async function readBackupMeta(
  handle: SQLiteDatabase,
  tables: readonly string[],
): Promise<BackupMeta | null> {
  if (!tables.includes(BACKUP_META_TABLE)) return null;
  try {
    const rows = await handle.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM ${BACKUP_META_TABLE};`,
    );
    return parseBackupMeta(rows);
  } catch {
    // A `backup_meta` table of some other shape is not our marker.
    return null;
  }
}

/**
 * The figures shown on the confirm sheet ("this backup contains 412 documents…").
 * Raw SQL rather than a repository ON PURPOSE: every repository is bound to the
 * live singleton, and the whole point of this probe is that it runs against the
 * CANDIDATE, which is not a live database and never will be unless the owner
 * confirms. Soft-deleted rows are excluded, as they are everywhere.
 */
async function probeCounts(
  handle: SQLiteDatabase,
  format: BackupFormat,
): Promise<RestorePreview['counts']> {
  const one = async (sql: string): Promise<number> => {
    const row = await handle.getFirstAsync<{ c: number }>(sql);
    return row?.c ?? 0;
  };
  const hasLedger = format !== 'attachments';
  const hasAttachments = format !== 'erp';
  return {
    documents: hasLedger
      ? await one('SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL;')
      : 0,
    items: hasLedger ? await one('SELECT COUNT(*) AS c FROM items WHERE deleted_at IS NULL;') : 0,
    parties: hasLedger
      ? await one(
          'SELECT (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL) AS c;',
        )
      : 0,
    // COUNT(*) touches the row headers, not the blobs — no bytes are read here.
    attachments: hasAttachments ? await one('SELECT COUNT(*) AS c FROM attachments;') : 0,
  };
}

/** Drop a staged candidate the owner declined. Safe to call at any time. */
export function discardStagedCandidate(format: BackupFormat): void {
  deleteWithSidecars(stagedPathFor(format));
}

// ---------------------------------------------------------------------------
// 3. THE SWAP
// ---------------------------------------------------------------------------

/**
 * Marker written to MMKV BEFORE the first destructive byte and cleared only on
 * success. Its presence at boot means the process died mid-swap and a live file
 * may be half-written — `detectInterruptedRestore()` reads it and the app offers
 * the snapshots back rather than booting onto a broken database.
 */
const MARKER_KEY = 'restore.inProgress';

/** One live database, its pre-restore snapshot, and where it belongs. */
export type RestoreMarkerEntry = {
  target: RestoreTarget;
  /** `file://` URI of the pre-restore safety snapshot — the rollback source. */
  snapshotUri: string;
  /** `file://` URI of the live database being replaced. */
  liveUri: string;
};

export type RestoreMarker = {
  format: BackupFormat;
  /**
   * EVERY database this restore touches. A merged file has two entries; that is
   * the whole reason this is a list rather than a single triple — rolling back
   * only the ledger would leave the receipts describing a history that no longer
   * exists.
   */
  entries: RestoreMarkerEntry[];
  startedAt: number;
};

function writeMarker(marker: RestoreMarker): void {
  storage.set(MARKER_KEY, JSON.stringify(marker));
}

function clearMarker(): void {
  storage.remove(MARKER_KEY);
}

/**
 * Replace the live database(s) with the validated staged file.
 *
 * Callers MUST have gone through `inspectBackupFile()` and an explicit owner
 * confirmation first. On return the live handles are CLOSED — nothing may read
 * them again in this process, which is why the result demands a restart.
 */
export async function applyRestore(preview: RestorePreview): Promise<RestoreResult> {
  const { format, stagedPath } = preview;
  const staged = new File(toFileUri(stagedPath));
  if (!staged.exists) throw new RestoreError('file-missing');

  const targets = restoreTargetsFor(format);
  const promotionTarget = promotionTargetFor(format);

  // Fail EARLY on a full disk: the safety snapshots are full second copies of
  // the live databases, and a restore whose rollback source could not be written
  // is not a restore worth starting.
  const liveBytes = targets.reduce((sum, t) => sum + new File(toFileUri(livePathFor(t))).size, 0);
  if (Paths.availableDiskSpace < liveBytes + staged.size) throw new RestoreError('no-space');

  // (2) SAFETY SNAPSHOTS — checkpoint + copy, via the backup module's primitive.
  // Taken for every database this restore will touch, BEFORE any of them close.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const entries: RestoreMarkerEntry[] = [];
  for (const target of targets) {
    const safety = await snapshot(liveHandle(target), `pre-restore-${target}-${stamp}.db`);
    entries.push({
      target,
      snapshotUri: safety.uri,
      liveUri: toFileUri(livePathFor(target)),
    });
  }

  // The point of no return. Everything past here is recoverable only from the
  // marker + the snapshots above.
  writeMarker({ format, entries, startedAt: Date.now() });

  try {
    // (3) CLOSE every live handle, (4) drop THEIR sidecars, (5) promote.
    for (const target of targets) {
      await liveHandle(target).closeAsync();
      deleteWithSidecars(livePathFor(target));
    }
    staged.copySync(new File(toFileUri(livePathFor(promotionTarget))));
  } catch {
    // Nothing was written yet, or only partially — put the snapshots back.
    await rollbackEntries(entries);
    clearMarker();
    throw new RestoreError('copy-failed');
  }

  // (5b) MIGRATE forward, split the merged payload out, drop the artifacts.
  try {
    await finishRestore(format);
  } catch {
    await rollbackEntries(entries);
    clearMarker();
    throw new RestoreError('migrate-failed');
  }

  clearMarker();
  deleteWithSidecars(stagedPath);
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
async function finishRestore(format: BackupFormat): Promise<void> {
  if (format === 'attachments') {
    await withFreshHandle('attachments', async (handle) => {
      migrateAttachmentsDatabase(handle);
    });
    return;
  }

  const ledgerPath = livePathFor('erp');
  await withFreshHandle('erp', async (handle) => {
    migrateErpDatabase(handle, drizzleFor(handle));
  });

  if (format !== 'merged') return;

  // SPLIT: a brand-new attachments.db (the old one was deleted in the swap),
  // bootstrapped and then filled from the ledger's merged-in payload. The copy
  // is an `INSERT … SELECT` across an ATTACH — SQLite streams the blobs and JS
  // never holds a receipt photo.
  await withFreshHandle('attachments', async (handle) => {
    migrateAttachmentsDatabase(handle);
    await handle.execAsync(extractAttachmentsSql(ledgerPath));
  });

  // The payload and the marker are BACKUP artifacts, not ledger data. Dropping
  // them leaves `erp.db` in exactly the shape a never-restored one has — which
  // matters, because the next backup snapshots this file and would otherwise
  // merge a stale copy of the receipts into itself.
  await withFreshHandle('erp', async (handle) => {
    await handle.execAsync(DROP_MERGED_ARTIFACTS_SQL);
    try {
      // Reclaim the pages the dropped blobs occupied. Best-effort: VACUUM needs
      // temp space, and a ledger that is merely larger than it needs to be is
      // still a correct ledger.
      await handle.execAsync('VACUUM;');
    } catch {
      // Not fatal. See above.
    }
  });
}

/**
 * Open a live database on a fresh connection, run `work`, then checkpoint, close
 * and delete the sidecars — so no `-wal`/`-shm` is left for the next launch to
 * inherit beside a file it did not come from.
 */
async function withFreshHandle(
  target: RestoreTarget,
  work: (handle: SQLiteDatabase) => Promise<void> | void,
): Promise<void> {
  const handle = await openDatabaseAsync(DB_FILE[target], { useNewConnection: true });
  try {
    await work(handle);
    await handle.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    await handle.closeAsync();
    deleteSidecars(livePathFor(target));
  }
}

/** Put every `pre-restore-` snapshot back over its live path. */
async function rollbackEntries(entries: readonly RestoreMarkerEntry[]): Promise<void> {
  for (const entry of entries) {
    const snap = new File(entry.snapshotUri);
    // Nothing better to do for this one; the marker stays for the boot gate.
    if (!snap.exists) continue;
    const livePath = entry.liveUri.replace(/^file:\/\//, '');
    deleteWithSidecars(livePath);
    snap.copySync(new File(entry.liveUri));
  }
}

// ---------------------------------------------------------------------------
// 4. INTERRUPTED-RESTORE RECOVERY (next launch)
// ---------------------------------------------------------------------------

/**
 * A restore that never finished — read at boot, BEFORE migrations run. A marker
 * here means the process was killed (or storage filled) between closing a live
 * handle and finishing the copy, so a file at a live path may be half written.
 * Booting the app onto it would either crash on first read or, worse, not crash.
 */
export function detectInterruptedRestore(): RestoreMarker | null {
  const raw = storage.getString(MARKER_KEY);
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as RestoreMarker;
    if (!Array.isArray(marker?.entries) || marker.entries.length === 0) return null;
    if (marker.entries.some((e) => !e?.snapshotUri || !e?.liveUri || !e?.target)) return null;
    return marker;
  } catch {
    return null;
  }
}

/**
 * Are the snapshots this marker points at still on disk? Cache can be evicted,
 * and a partial rollback is worse than none — for a merged restore both halves
 * must be recoverable or neither is offered.
 */
export function isRollbackAvailable(marker: RestoreMarker): boolean {
  return marker.entries.every((entry) => new File(entry.snapshotUri).exists);
}

/**
 * Roll the interrupted restore back to its pre-restore snapshots — ALL of them.
 * Closes the live handles first (they were opened by the module imports at boot,
 * onto whatever bytes survived), so a restart is required afterwards exactly as
 * after a restore.
 */
export async function rollbackInterruptedRestore(marker: RestoreMarker): Promise<void> {
  if (!isRollbackAvailable(marker)) throw new RestoreError('file-missing');
  for (const entry of marker.entries) {
    await liveHandle(entry.target).closeAsync();
  }
  await rollbackEntries(marker.entries);
  clearMarker();
}

/** Keep whatever is on disk and boot normally. The owner's call, not ours. */
export function discardInterruptedRestore(): void {
  clearMarker();
}
