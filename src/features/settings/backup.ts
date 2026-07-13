import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';
import { attachmentsDb } from '@/db/attachments-client';

/**
 * Snapshot the live SQLite databases to dated files and hand them to the OS share
 * sheet so the owner can save them to Downloads / Drive / Files. This is the only
 * cross-platform way to "download" a file from an Expo app — a direct write to
 * the Android Downloads folder needs the Storage Access Framework and iOS has no
 * shared Downloads dir at all, so the share sheet is the correct primitive.
 *
 * There are TWO databases: the main ledger (`erp.db`) and the receipt attachment
 * bytes (`attachments.db`). Both are copied and shared so a restore recovers the
 * documents AND their attached photos/PDFs.
 *
 * WAL note: `enableChangeListener` puts the db in WAL mode, so recent writes may
 * still live in `*.db-wal` and NOT the main file. We checkpoint (TRUNCATE) first
 * to fold the WAL back into the main file, otherwise the copy misses them.
 */
export type BackupResult = { shared: boolean; fileNames: string[] };

/** Checkpoint + copy one db to a dated cache file; returns the snapshot File. */
async function snapshot(db: SQLiteDatabase, fileName: string): Promise<File> {
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  // `databasePath` is a bare filesystem path (e.g. /data/.../erp.db); the File
  // API needs a file:// URI, otherwise Android throws "URI is not absolute".
  const path = db.databasePath;
  const source = new File(path.startsWith('file://') ? path : `file://${path}`);
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete(); // copy() throws if the target exists
  source.copy(dest);
  return dest;
}

export async function backupDatabase(): Promise<BackupResult> {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const erpName = `erp-backup-${stamp}.db`;
  const attName = `erp-attachments-${stamp}.db`;

  const erpFile = await snapshot(sqlite, erpName);
  const attFile = await snapshot(attachmentsDb, attName);
  const fileNames = [erpName, attName];

  // Offer both files to the OS share sheet. Sharing handles one file per sheet,
  // so present them back to back (ledger first, then attachments).
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { shared: false, fileNames };

  await Sharing.shareAsync(erpFile.uri, {
    mimeType: 'application/x-sqlite3',
    UTI: 'public.database',
    dialogTitle: erpName,
  });
  await Sharing.shareAsync(attFile.uri, {
    mimeType: 'application/x-sqlite3',
    UTI: 'public.database',
    dialogTitle: attName,
  });
  return { shared: true, fileNames };
}
