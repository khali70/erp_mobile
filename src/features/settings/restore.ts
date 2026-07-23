import { BackHandler, Platform } from 'react-native';
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
  SQLITE_MAGIC_LENGTH,
  isSqliteHeader,
  needsForwardMigration,
  validateCandidate,
  walSidecarPaths,
  type RestoreFailureCode,
  type RestoreTarget,
} from './restore-validation';

/**
 * RESTORE — the inverse of ./backup, and the single most destructive action in
 * the app. It replaces the owner's live database with a file they picked. There
 * is no server copy to fall back on, so every trap `backup.ts` documents is here
 * again, in reverse, plus the ones that only exist on the way in.
 *
 * The ORDER below is the whole design and is not negotiable:
 *
 *   validate → safety-snapshot → close handles → clear WAL → copy → migrate → restart
 *
 *  1. VALIDATE on a COPY, in the databases directory under a `restore-candidate-`
 *     name. Nothing whatsoever touches the live path until the owner has seen
 *     what is in the file and confirmed. A picked file may be a JPEG, someone
 *     else's SQLite database, the *other* one of our two files, or a backup from
 *     a NEWER build (refused — forward-only migrations cannot undo a future
 *     column, so a downgrade reads a schema it does not understand).
 *
 *  2. SAFETY SNAPSHOT via backup.ts's `snapshot()` — checkpoint + copy, written
 *     to cache with a `pre-restore-` prefix. It is the only rollback source.
 *
 *  3. CLOSE the live handle first. Copying over an OPEN SQLite file is how you
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
 *     build gains the columns this build expects. A failure here rolls the
 *     snapshot back in place before it throws.
 *
 *  6. RESTART. Not an afterthought: by this point the live handle is CLOSED and
 *     every hydrated store and cached query in the process points at bytes that
 *     no longer exist. See `CAN_RELOAD_PROGRAMMATICALLY` below.
 *
 * TWO DATABASES, as in backup: the ledger (`erp.db`) and the receipt bytes
 * (`attachments.db`). The backup flow emits them as two separate files, so a
 * full restore is two picks. They are restored independently and a ledger
 * restored without its matching attachments is allowed (the receipts are simply
 * missing) — but the owner is told.
 *
 * CONTENT-URI trap, same as backup's: the picker hands back a `content://` URI
 * on Android, and `File` needs a `file://` one. `copyToCacheDirectory: true`
 * makes the picker do that translation for us.
 *
 * COSTING: after a restore the WAC state is whatever the restored file says it
 * is. Nothing here recomputes, patches or "repairs" it — a restore that quietly
 * rewrites the owner's cost history is not a restore.
 */

/** Which of the two databases a candidate replaces. */
export type { RestoreTarget } from './restore-validation';

/** What the owner is shown before they confirm. */
export type RestorePreview = {
  target: RestoreTarget;
  fileName: string;
  fileSize: number;
  isValidSqlite: boolean;
  schemaOk: boolean;
  /** `PRAGMA user_version` of the PICKED file (0 for pre-versioning backups). */
  userVersion: number;
  /** Whether this build must migrate the file forward after the swap. */
  needsMigration: boolean;
  /** Ledger only; zeroes for the attachments DB. Read from the staged copy. */
  counts: { documents: number; items: number; parties: number };
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
  /** For `wrong-slot`: the slot the picked file actually belongs to. */
  readonly actualTarget?: RestoreTarget;
  readonly fileVersion?: number;

  constructor(code: RestoreErrorCode, details?: { actualTarget?: RestoreTarget; fileVersion?: number }) {
    super(code);
    this.name = 'RestoreError';
    this.code = code;
    this.actualTarget = details?.actualTarget;
    this.fileVersion = details?.fileVersion;
  }
}

/**
 * NO programmatic reload primitive is installed in this project.
 *
 * `expo-updates` (whose `reloadAsync()` is the supported way to restart an Expo
 * app) is NOT in package.json, and `DevSettings.reload()` is a dev-only bridge
 * that would not reset the native SQLite connection cache anyway. So the app
 * does NOT restart itself: the success state is a blocking, non-dismissible
 * dialog telling the owner to fully close and reopen the app, which is the
 * honest thing to show when the alternative is letting screens read from a
 * handle that has been closed under them.
 *
 * If `expo-updates` is ever added, flip this and call `Updates.reloadAsync()`.
 */
export const CAN_RELOAD_PROGRAMMATICALLY = false;

/**
 * The nearest thing to a restart this project actually has.
 *
 * Android can finish the root activity, which is precisely what the success copy
 * asks the owner to do by hand. iOS forbids an app from terminating itself (it
 * reads as a crash to the user and is an App Store rejection), so there it
 * returns false and the caller falls back to leaving the "close and reopen the
 * app" instruction on screen. Returns whether the app is on its way out.
 */
export function requestAppExit(): boolean {
  if (Platform.OS !== 'android') return false;
  BackHandler.exitApp();
  return true;
}

const DB_FILE: Record<RestoreTarget, string> = {
  erp: 'erp.db',
  attachments: 'attachments.db',
};

/** Staged under the databases directory so the swap is a same-volume copy. */
const STAGED_FILE: Record<RestoreTarget, string> = {
  erp: 'restore-candidate-erp.db',
  attachments: 'restore-candidate-attachments.db',
};

function liveHandle(target: RestoreTarget): SQLiteDatabase {
  return target === 'erp' ? sqlite : attachmentsDb;
}

/** `databasePath` is a bare path; the File API needs a `file://` URI. */
function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** The directory expo-sqlite keeps the databases in, derived from a live handle. */
function databasesDir(): string {
  return Paths.dirname(sqlite.databasePath);
}

function stagedPathFor(target: RestoreTarget): string {
  return Paths.join(databasesDir(), STAGED_FILE[target]);
}

function livePathFor(target: RestoreTarget): string {
  return liveHandle(target).databasePath;
}

/** Delete a file and every WAL/journal sidecar beside it. Missing files are fine. */
function deleteWithSidecars(path: string): void {
  for (const p of [path, ...walSidecarPaths(path)]) {
    const f = new File(toFileUri(p));
    if (f.exists) f.delete();
  }
}

function deleteSidecars(path: string): void {
  for (const p of walSidecarPaths(path)) {
    const f = new File(toFileUri(p));
    if (f.exists) f.delete();
  }
}

// ---------------------------------------------------------------------------
// 1. PICK
// ---------------------------------------------------------------------------

/**
 * Open the system document picker. Resolves to `null` when the owner backs out
 * — a cancel is a normal, silent no-op, never an error dialog.
 *
 * The ANY-type filter is on purpose: Android reports `.db` files with a mixture of MIME
 * types (`application/octet-stream`, `application/vnd.sqlite3`, or nothing at
 * all) depending on the provider, so filtering by MIME hides the very file the
 * owner is looking for. The real filter is the header + schema check below.
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
// 2. VALIDATE — on a copy, never on the live path
// ---------------------------------------------------------------------------

/**
 * Stage the picked file next to the live databases and inspect it there.
 *
 * "Read-only" here means the LIVE database is never opened, read or touched:
 * the candidate itself has to be opened writably, because a WAL-mode file (which
 * every backup this app produces is) creates its sidecars on open. Those are
 * checkpointed and deleted again before we return, so what gets promoted is a
 * single self-contained main file.
 *
 * Throws `RestoreError` with a specific code; the live DB is untouched on every
 * path out of this function.
 */
export async function inspectBackupFile(
  target: RestoreTarget,
  asset: DocumentPickerAsset,
): Promise<RestorePreview> {
  const source = new File(asset.uri);
  if (!source.exists) throw new RestoreError('file-missing');

  const stagedPath = stagedPathFor(target);
  deleteWithSidecars(stagedPath); // a previous, abandoned inspection
  const staged = new File(toFileUri(stagedPath));
  source.copySync(staged);

  let header: Uint8Array = new Uint8Array(0);
  let handle: SQLiteDatabase | null = null;
  try {
    // Header first, off a file handle — `bytes()` would read the WHOLE database
    // into JS memory, and a shop's ledger with receipt bytes is not small. It is
    // also the cheapest possible rejection: a JPEG never reaches SQLite at all.
    header = readHeader(staged);
    if (!isSqliteHeader(header)) throw new RestoreError('not-sqlite');

    handle = await openDatabaseAsync(STAGED_FILE[target], { useNewConnection: true });

    const tables = (
      await handle.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table';",
      )
    ).map((r) => r.name);
    const versionRow = await handle.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version;',
    );
    const userVersion = versionRow?.user_version ?? 0;

    const rejection = validateCandidate({ target, header, tables, userVersion });
    if (rejection) {
      throw new RestoreError(rejection.code, {
        actualTarget: rejection.actualTarget,
        fileVersion: rejection.fileVersion,
      });
    }

    const counts =
      target === 'erp' ? await probeCounts(handle) : { documents: 0, items: 0, parties: 0 };

    return {
      target,
      fileName: asset.name,
      fileSize: asset.size ?? staged.size,
      isValidSqlite: true,
      schemaOk: true,
      userVersion,
      needsMigration: needsForwardMigration(userVersion),
      counts,
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
 * The row counts shown on the confirm sheet ("this backup contains 412
 * documents…"). Raw SQL rather than a repository ON PURPOSE: every repository is
 * bound to the live singleton, and the whole point of this probe is that it runs
 * against the CANDIDATE, which is not the live database and never will be unless
 * the owner confirms. Soft-deleted rows are excluded, as they are everywhere.
 */
async function probeCounts(handle: SQLiteDatabase): Promise<RestorePreview['counts']> {
  const one = async (sql: string): Promise<number> => {
    const row = await handle.getFirstAsync<{ c: number }>(sql);
    return row?.c ?? 0;
  };
  return {
    documents: await one('SELECT COUNT(*) AS c FROM documents WHERE deleted_at IS NULL;'),
    items: await one('SELECT COUNT(*) AS c FROM items WHERE deleted_at IS NULL;'),
    parties: await one(
      'SELECT (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) + ' +
        '(SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL) AS c;',
    ),
  };
}

/** Drop a staged candidate the owner declined. Safe to call at any time. */
export function discardStagedCandidate(target: RestoreTarget): void {
  deleteWithSidecars(stagedPathFor(target));
}

// ---------------------------------------------------------------------------
// 3. THE SWAP
// ---------------------------------------------------------------------------

/**
 * Marker written to MMKV BEFORE the first destructive byte and cleared only on
 * success. Its presence at boot means the process died mid-swap and the live
 * file may be half-written — `detectInterruptedRestore()` reads it and the app
 * offers the snapshot back rather than booting onto a broken database.
 */
const MARKER_KEY = 'restore.inProgress';

export type RestoreMarker = {
  target: RestoreTarget;
  /** `file://` URI of the pre-restore safety snapshot — the rollback source. */
  snapshotUri: string;
  /** `file://` URI of the live database being replaced. */
  liveUri: string;
  startedAt: number;
};

function writeMarker(marker: RestoreMarker): void {
  storage.set(MARKER_KEY, JSON.stringify(marker));
}

function clearMarker(): void {
  storage.remove(MARKER_KEY);
}

/**
 * Replace the live database for `target` with the validated staged file.
 *
 * Callers MUST have gone through `inspectBackupFile()` and an explicit owner
 * confirmation first. On return the live handle is CLOSED — nothing may read the
 * database again in this process, which is why the result demands a restart.
 */
export async function applyRestore(preview: RestorePreview): Promise<RestoreResult> {
  const { target, stagedPath } = preview;
  const staged = new File(toFileUri(stagedPath));
  if (!staged.exists) throw new RestoreError('file-missing');

  const live = liveHandle(target);
  const livePath = livePathFor(target);
  const liveUri = toFileUri(livePath);
  const liveFile = new File(liveUri);

  // Fail EARLY on a full disk: the safety snapshot is a full second copy of the
  // live database, and a restore whose rollback source could not be written is
  // not a restore worth starting.
  const needed = liveFile.size + staged.size;
  if (Paths.availableDiskSpace < needed) throw new RestoreError('no-space');

  // (2) SAFETY SNAPSHOT — checkpoint + copy, via the backup module's primitive.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const safety = await snapshot(live, `pre-restore-${target}-${stamp}.db`);

  // The point of no return. Everything past here is recoverable only from the
  // marker + the snapshot above.
  writeMarker({ target, snapshotUri: safety.uri, liveUri, startedAt: Date.now() });

  try {
    // (3) CLOSE the live handle, (4) drop ITS sidecars, (5) swap.
    await live.closeAsync();
    deleteWithSidecars(livePath);
    staged.copySync(new File(liveUri));
  } catch {
    // Nothing was written yet, or only partially — put the snapshot back.
    await rollbackTo(safety.uri, liveUri, livePath);
    clearMarker();
    throw new RestoreError('copy-failed');
  }

  // (5b) MIGRATE the restored file forward, on a fresh connection.
  try {
    await migrateRestoredFile(target, livePath);
  } catch {
    await rollbackTo(safety.uri, liveUri, livePath);
    clearMarker();
    throw new RestoreError('migrate-failed');
  }

  clearMarker();
  deleteWithSidecars(stagedPath);
  return { restored: [target], rollbackAvailable: true, requiresRestart: true };
}

/**
 * Run the app's real migration path over the file now sitting at the live path.
 *
 * A fresh connection, because the singleton was closed for the swap and must
 * stay closed — reopening it here would hand the rest of the app a handle onto a
 * database it has already cached stale pages for. Checkpointed and closed again
 * so no `-wal`/`-shm` is left behind for the next launch to inherit.
 */
async function migrateRestoredFile(target: RestoreTarget, livePath: string): Promise<void> {
  const fresh = await openDatabaseAsync(DB_FILE[target], { useNewConnection: true });
  try {
    if (target === 'erp') migrateErpDatabase(fresh, drizzleFor(fresh));
    else migrateAttachmentsDatabase(fresh);
    await fresh.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    await fresh.closeAsync();
    deleteSidecars(livePath);
  }
}

/** Put a `pre-restore-` snapshot back over the live path. */
async function rollbackTo(snapshotUri: string, liveUri: string, livePath: string): Promise<void> {
  const snap = new File(snapshotUri);
  if (!snap.exists) return; // nothing better to do; the marker stays for the boot gate
  deleteWithSidecars(livePath);
  snap.copySync(new File(liveUri));
}

// ---------------------------------------------------------------------------
// 4. INTERRUPTED-RESTORE RECOVERY (next launch)
// ---------------------------------------------------------------------------

/**
 * A restore that never finished — read at boot, BEFORE migrations run. A marker
 * here means the process was killed (or storage filled) between closing the live
 * handle and finishing the copy, so the file at the live path may be half
 * written. Booting the app onto it would either crash on first read or, worse,
 * not crash.
 */
export function detectInterruptedRestore(): RestoreMarker | null {
  const raw = storage.getString(MARKER_KEY);
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as RestoreMarker;
    if (!marker?.snapshotUri || !marker?.liveUri) return null;
    return marker;
  } catch {
    return null;
  }
}

/** Is the snapshot this marker points at still on disk? Cache can be evicted. */
export function isRollbackAvailable(marker: RestoreMarker): boolean {
  return new File(marker.snapshotUri).exists;
}

/**
 * Roll the interrupted restore back to its pre-restore snapshot. Closes the live
 * handle first (it was opened by the module import at boot, onto whatever bytes
 * survived), so a restart is required afterwards exactly as after a restore.
 */
export async function rollbackInterruptedRestore(marker: RestoreMarker): Promise<void> {
  if (!isRollbackAvailable(marker)) throw new RestoreError('file-missing');
  const live = liveHandle(marker.target);
  const livePath = livePathFor(marker.target);
  await live.closeAsync();
  await rollbackTo(marker.snapshotUri, toFileUri(livePath), livePath);
  clearMarker();
}

/** Keep whatever is on disk and boot normally. The owner's call, not ours. */
export function discardInterruptedRestore(): void {
  clearMarker();
}
