import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';
import { attachmentsDb } from '@/db/attachments-client';
import { APP_SCHEMA_VERSION } from '@/db/schema-version';
import { mergeAttachmentsSql, writeBackupMetaSql } from './backup-format';
import {
  databasesDirectory,
  databasesPath,
  deleteSidecars,
  deleteWithSidecars,
  toFileUri,
} from './db-files';

/**
 * Snapshot the owner's data to ONE dated file and hand it to the OS share sheet
 * so they can save it to Downloads / Drive / Files. The share sheet is the only
 * cross-platform way to "download" a file from an Expo app — writing straight to
 * the Android Downloads folder needs the Storage Access Framework, and iOS has
 * no shared Downloads directory at all.
 *
 * ONE FILE, AND WHY IT USED TO BE TWO
 * -----------------------------------
 * The app keeps two databases: the ledger (`erp.db`) and the receipt attachment
 * bytes (`attachments.db`). This function used to snapshot both and call
 * `Sharing.shareAsync` twice, back to back — and that quietly lost the second
 * one. `shareAsync` resolves when the CHOOSER is dismissed, not when the file
 * has finished being saved, so the second sheet was requested while the first
 * was still settling and Android swallowed it. In practice owners received
 * `erp-backup-*.db` and nothing else: the receipt photos they believed were
 * backed up had never reached their storage, and the attachments half of restore
 * was unreachable because the file it wanted did not exist.
 *
 * So the two databases are MERGED into a single self-contained `.db` before
 * sharing: one file, one sheet, one save, nothing to drop. The merge uses
 * SQLite's own `ATTACH` + `INSERT … SELECT`, which streams the blobs inside
 * SQLite — receipt bytes never pass through JS memory, and the app gains no
 * archiving dependency. The merged file declares itself in a `backup_meta` table
 * so restore recognises it by VALUE, not by guessing from table names; the
 * format and its SQL live in ./backup-format, shared with the restore side.
 *
 * WAL note: `enableChangeListener` puts the ledger in WAL mode, so recent writes
 * may still live in `*.db-wal` and NOT the main file. Every snapshot checkpoints
 * (TRUNCATE) first to fold the WAL back in, otherwise the copy misses them.
 */
export type BackupResult = { shared: boolean; fileName: string };

/**
 * Checkpoint + copy one db to a file; returns the copy.
 *
 * Exported because RESTORE takes the SAME snapshot before it overwrites a live
 * file (`pre-restore-*.db`), and that snapshot is the only thing a bad restore
 * can be rolled back from. Two copies of the checkpoint-then-copy dance would be
 * two chances to forget the checkpoint — and forgetting it silently drops every
 * write still sitting in the WAL.
 */
export async function snapshot(
  db: SQLiteDatabase,
  fileName: string,
  directory: Directory = Paths.cache,
): Promise<File> {
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  const source = new File(toFileUri(db.databasePath));
  const dest = new File(directory, fileName);
  if (dest.exists) dest.delete(); // copy() throws if the target exists
  // copySync, NOT the async copy(): the caller must be able to treat the
  // returned File as finished. Restore overwrites the live database on the very
  // next line after taking its safety snapshot — a copy still in flight there is
  // a rollback source that does not exist yet.
  source.copySync(dest);
  return dest;
}

/**
 * The file the merge is BUILT in. It lives in the databases directory, not in
 * cache, because that is the directory `openDatabaseAsync` opens by name — the
 * finished file is copied out to cache for sharing once it is closed and its
 * sidecars are gone.
 */
const WORKING_FILE = 'backup-working.db';

export async function backupDatabase(): Promise<BackupResult> {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `rafuf-backup-${stamp}.db`;

  const merged = await buildMergedBackup(fileName);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { shared: false, fileName };

  await Sharing.shareAsync(merged.uri, {
    mimeType: 'application/x-sqlite3',
    UTI: 'public.database',
    dialogTitle: fileName,
  });
  return { shared: true, fileName };
}

/**
 * Ledger snapshot + attachments payload + self-declaration, in one file.
 *
 * Order matters: the attachments database is checkpointed BEFORE it is attached
 * so that everything the owner has just photographed is in its main file rather
 * than only in its WAL, and the working file is checkpointed and closed BEFORE
 * it is copied out, so what gets shared is one self-contained database with no
 * sidecars to lose.
 */
async function buildMergedBackup(fileName: string): Promise<File> {
  const workingPath = databasesPath(WORKING_FILE);
  deleteWithSidecars(workingPath); // an abandoned earlier run

  // (1) The ledger, checkpointed and copied into the databases directory.
  await snapshot(sqlite, WORKING_FILE, databasesDirectory());

  // (2) Fold the receipt bytes in. The attachments db is checkpointed through
  // its own handle first; the ATTACH below reads the resulting main file.
  await attachmentsDb.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  const working = await openDatabaseAsync(WORKING_FILE, { useNewConnection: true });
  try {
    await working.execAsync(mergeAttachmentsSql(attachmentsDb.databasePath));

    const countRow = await working.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM attachments;',
    );

    // (3) Declare the format, LAST — a file only claims to be a merged backup
    // once the payload it claims to carry is actually in it.
    await working.execAsync(
      writeBackupMetaSql({
        createdAt: Date.now(),
        appSchemaVersion: APP_SCHEMA_VERSION,
        attachmentCount: countRow?.c ?? 0,
      }),
    );

    await working.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } finally {
    await working.closeAsync();
    deleteSidecars(workingPath);
  }

  // (4) Out to cache under the dated name the owner will see and save.
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete();
  new File(toFileUri(workingPath)).copySync(dest);
  deleteWithSidecars(workingPath);
  return dest;
}
