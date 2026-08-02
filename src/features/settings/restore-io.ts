import { openDatabaseAsync } from 'expo-sqlite';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { sqlite } from '@/db/client';
import { attachmentsDb, migrateAttachmentsDatabase } from '@/db/attachments-client';
import { drizzleFor, migrateErpDatabase } from '@/db/migrate';
import { storage } from '@/store/mmkv';
import { VOICE_DIR } from '@/features/voice-notes/utils/voiceFilePath';
import { databasesPath, toFileUri } from './db-files';
import type { RestoreDb, RestoreIo } from './restore-engine';
import type { RestoreTarget } from './backup-format';

/**
 * The phone half of `RestoreIo` — every expo-file-system and expo-sqlite call
 * the restore sequence makes, and NOTHING else. There is not one decision in
 * this file: no ordering, no validation, no rollback. All of that lives in
 * ./restore-engine, where the suite runs it for real against `node:fs` and
 * better-sqlite3.
 *
 * That split exists because the destructive half of a backup feature cannot be
 * signed off on a mock. What stays untested here is a thin binding whose only
 * possible mistake is calling the wrong function — visible on one screen, unlike
 * an ordering bug in the swap.
 */

/** MMKV key of the in-progress marker the boot gate reads. */
const MARKER_KEY = 'restore.inProgress';

const DB_FILE: Record<RestoreTarget, string> = {
  erp: 'erp.db',
  attachments: 'attachments.db',
};

const liveHandle = (target: RestoreTarget) => (target === 'erp' ? sqlite : attachmentsDb);

/** expo-sqlite opens by NAME within a directory; the engine speaks in paths. */
async function openByPath(path: string): Promise<RestoreDb> {
  const handle = await openDatabaseAsync(
    Paths.basename(path),
    { useNewConnection: true },
    Paths.dirname(path),
  );
  return {
    exec: (sql) => handle.execAsync(sql),
    all: <T>(sql: string) => handle.getAllAsync<T>(sql),
    first: <T>(sql: string) => handle.getFirstAsync<T>(sql),
    close: () => handle.closeAsync(),
  };
}

export const expoRestoreIo: RestoreIo = {
  now: () => Date.now(),

  livePath: (target) => liveHandle(target).databasePath,
  stagePath: (fileName) => databasesPath(fileName),
  cachePath: (fileName) => Paths.join(Paths.cache.uri, fileName),

  exists: (path) => new File(toFileUri(path)).exists,
  size: (path) => {
    const file = new File(toFileUri(path));
    return file.exists ? (file.size ?? 0) : 0;
  },
  readBytes: (path) => new File(toFileUri(path)).bytesSync(),
  readHeader: (path, length) => {
    // Off a file HANDLE, not `bytes()`: reading a whole file to look at 16 bytes
    // would pull a backup full of receipt photos into JS memory.
    try {
      const fh = new File(toFileUri(path)).open(FileMode.ReadOnly);
      try {
        return fh.readBytes(length);
      } finally {
        fh.close();
      }
    } catch {
      // Unreadable, or shorter than the header — not a SQLite file either way.
      return new Uint8Array(0);
    }
  },
  writeBytes: (path, bytes) => {
    const file = new File(toFileUri(path));
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
  },
  copyFile: (from, to) => {
    const dest = new File(toFileUri(to));
    if (dest.exists) dest.delete(); // copy() throws if the target exists
    // copySync, NOT the async copy(): the caller treats the destination as
    // finished on the very next line — a copy still in flight during a swap is a
    // rollback source that does not exist yet.
    new File(toFileUri(from)).copySync(dest);
  },
  removeFile: (path) => {
    const file = new File(toFileUri(path));
    if (file.exists) file.delete();
  },
  availableDiskSpace: () => Paths.availableDiskSpace,

  voiceDirPath: () => new Directory(Paths.document, VOICE_DIR).uri,
  ensureDir: (path) => {
    const dir = new Directory(toFileUri(path));
    if (!dir.exists) dir.create({ intermediates: true });
  },

  checkpointLive: (target) => liveHandle(target).execAsync('PRAGMA wal_checkpoint(TRUNCATE);'),
  closeLive: (target) => liveHandle(target).closeAsync(),
  openDb: openByPath,

  migrateErp: async () => {
    const handle = await openDatabaseAsync(DB_FILE.erp, {
      useNewConnection: true,
    });
    try {
      migrateErpDatabase(handle, drizzleFor(handle));
      await handle.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    } finally {
      await handle.closeAsync();
    }
  },
  migrateAttachments: async () => {
    const handle = await openDatabaseAsync(DB_FILE.attachments, {
      useNewConnection: true,
    });
    try {
      migrateAttachmentsDatabase(handle);
      await handle.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    } finally {
      await handle.closeAsync();
    }
  },

  readMarker: () => storage.getString(MARKER_KEY) ?? null,
  writeMarker: (value) => storage.set(MARKER_KEY, value),
  clearMarker: () => storage.remove(MARKER_KEY),
};
