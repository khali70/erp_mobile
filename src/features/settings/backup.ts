import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';

/**
 * Snapshot the live SQLite database to a dated file and hand it to the OS share
 * sheet so the owner can save it to Downloads / Drive / Files. This is the only
 * cross-platform way to "download" a file from an Expo app — a direct write to
 * the Android Downloads folder needs the Storage Access Framework and iOS has no
 * shared Downloads dir at all, so the share sheet is the correct primitive.
 *
 * WAL note: `enableChangeListener` puts the db in WAL mode, so recent writes may
 * still live in `erp.db-wal` and NOT the main file. We checkpoint (TRUNCATE)
 * first to fold the WAL back into `erp.db`, otherwise the copy misses them.
 */
export type BackupResult = { shared: boolean; fileName: string };

export async function backupDatabase(): Promise<BackupResult> {
  // 1. Flush WAL into the main database file.
  await sqlite.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  // 2. Copy the on-disk db to a dated file in the cache dir.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `erp-backup-${stamp}.db`;
  // `databasePath` is a bare filesystem path (e.g. /data/.../erp.db); the File
  // API needs a file:// URI, otherwise Android throws "URI is not absolute".
  const dbPath = sqlite.databasePath;
  const source = new File(dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`);
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete(); // copy() throws if the target exists
  source.copy(dest);

  // 3. Offer the file to the OS share sheet (Save to Files / Downloads / Drive).
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { shared: false, fileName };

  await Sharing.shareAsync(dest.uri, {
    mimeType: 'application/x-sqlite3',
    UTI: 'public.database',
    dialogTitle: fileName,
  });
  return { shared: true, fileName };
}
