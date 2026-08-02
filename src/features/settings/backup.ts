import type { SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';
import { attachmentsDb } from '@/db/attachments-client';
import { VOICE_DIR, basename } from '@/features/voice-notes/utils/voiceFilePath';
import { buildBackupZip, exceedsBackupSizeLimit, MAX_BACKUP_BYTES } from './backup-format';
import { deleteSidecars, toFileUri } from './db-files';

/**
 * Snapshot the owner's data to ONE dated `.zip` and hand it to the OS share
 * sheet so they can save it to Downloads / Drive / Files. The share sheet is the
 * only cross-platform way to "download" a file from an Expo app — writing
 * straight to the Android Downloads folder needs the Storage Access Framework,
 * and iOS has no shared Downloads directory at all.
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
 * had no file to point at.
 *
 * So there is ONE artifact and ONE share: an archive holding both databases as
 * raw entries, `erp.db` and `attachments.db`. A zip is what the owner expects a
 * backup to look like and what any PC can open — they can see both files are in
 * there without installing anything, which is worth more than the bytes a
 * cleverer container would save. The archive layout, its compression level and
 * its size ceiling live in ./backup-format, shared with the restore side.
 *
 * WAL note: `enableChangeListener` puts the ledger in WAL mode, so recent writes
 * may still live in `*.db-wal` and NOT in the main file. Every snapshot
 * checkpoints (TRUNCATE) first to fold the WAL back in — without it, the copy is
 * silently missing whatever the owner did most recently, which is precisely the
 * work they are least able to reconstruct.
 */
export type BackupResult = { shared: boolean; fileName: string };

export type BackupErrorCode =
  /** Combined snapshots exceed what this device can hold in memory to zip. */
  'too-large';

/** A typed failure, so the screen can show a sentence the owner can act on. */
export class BackupError extends Error {
  readonly code: BackupErrorCode;
  /** Bytes measured, and the ceiling — both shown in the message. */
  readonly totalBytes: number;
  readonly limitBytes: number;

  constructor(code: BackupErrorCode, totalBytes: number, limitBytes = MAX_BACKUP_BYTES) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
    this.totalBytes = totalBytes;
    this.limitBytes = limitBytes;
  }
}

/** The two working snapshots, in cache, deleted on every path out. */
const SNAPSHOT_ERP = 'backup-erp.db';
const SNAPSHOT_ATTACHMENTS = 'backup-attachments.db';

/**
 * Checkpoint + copy one database to a cache file; returns the copy.
 *
 * The checkpoint is the load-bearing half: it folds the write-ahead log back
 * into the main file so the copy is complete as of now.
 */
async function snapshot(db: SQLiteDatabase, fileName: string): Promise<File> {
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  const source = new File(toFileUri(db.databasePath));
  const dest = new File(Paths.cache, fileName);
  if (dest.exists) dest.delete(); // copy() throws if the target exists
  // copySync, NOT the async copy(): the next line reads the result.
  source.copySync(dest);
  // A checkpointed database still gets `-wal`/`-shm` written beside the COPY by
  // nothing at all — but an abandoned earlier run may have left some. Clearing
  // them keeps what goes into the archive a single self-contained file.
  deleteSidecars(dest.uri);
  return dest;
}

/**
 * The live voice recordings, or none. Enumerated from the voice dir the feature
 * writes into; a shop that has never recorded has no directory at all, which is
 * not an error. These are the ORIGINAL files, not snapshots — they are only READ
 * for the archive and must never be deleted on the way out.
 */
function liveVoiceFiles(): File[] {
  const dir = new Directory(Paths.document, VOICE_DIR);
  if (!dir.exists) return [];
  return dir.list().filter((entry): entry is File => entry instanceof File);
}

export async function backupDatabase(): Promise<BackupResult> {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `rafuf-backup-${stamp}.zip`;

  const archive = new File(Paths.cache, fileName);
  const snapshots: File[] = [];
  try {
    const erp = await snapshot(sqlite, SNAPSHOT_ERP);
    snapshots.push(erp);
    const attachments = await snapshot(attachmentsDb, SNAPSHOT_ATTACHMENTS);
    snapshots.push(attachments);

    // SIZE FIRST, before a single byte is read into JS. `zipSync` needs both
    // databases AND every voice recording in memory at once plus its output
    // buffer; past the ceiling the OS kills the app mid-zip and the owner is told
    // nothing. A refusal they can act on ("free space / fewer photos") beats a
    // crash that looks like a bug. The voice files are MEASURED here (`.size`)
    // and only read below, so nothing is pulled into JS until the gate passes.
    const voiceFiles = liveVoiceFiles();
    const voiceBytesTotal = voiceFiles.reduce((sum, file) => sum + (file.size ?? 0), 0);
    const totalBytes = (erp.size ?? 0) + (attachments.size ?? 0) + voiceBytesTotal;
    if (exceedsBackupSizeLimit(totalBytes)) throw new BackupError('too-large', totalBytes);

    // `bytes()` (async), NOT `bytesSync()`: on a device without JSI the sync
    // native call can hand JS a Promise instead of a Uint8Array, and fflate then
    // zips the Promise's KEYS as empty folders — a lossless-looking archive with
    // none of the owner's data. Awaiting the async form guarantees real bytes,
    // for the recordings exactly as for the databases.
    const [erpBytes, attachmentsBytes] = await Promise.all([erp.bytes(), attachments.bytes()]);
    const voiceMap: Record<string, Uint8Array> = {};
    for (const file of voiceFiles) {
      voiceMap[basename(file.uri)] = await file.bytes();
    }
    const bytes = buildBackupZip(erpBytes, attachmentsBytes, voiceMap);

    if (archive.exists) archive.delete();
    archive.create();
    archive.write(bytes);
  } finally {
    // The snapshots are FULL copies of the owner's databases. Whatever happened
    // above, they do not get to sit in cache afterwards.
    for (const file of snapshots) {
      if (file.exists) file.delete();
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return { shared: false, fileName };

  await Sharing.shareAsync(archive.uri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: fileName,
  });
  return { shared: true, fileName };
}
