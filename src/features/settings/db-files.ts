import { File, Paths } from 'expo-file-system';
import { sqlite } from '@/db/client';
import { walSidecarPaths } from './restore-validation';

/**
 * Filesystem plumbing shared by backup and restore. Both have to reason about
 * the same three awkward facts, and two copies of that reasoning would be two
 * places to get it wrong.
 */

/**
 * `databasePath` is a bare filesystem path (e.g. `/data/.../erp.db`); the File
 * API needs a `file://` URI or Android throws "URI is not absolute". This is the
 * same trap the picker has in reverse (`content://` → cache copy).
 */
export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * The directory expo-sqlite keeps its databases in, derived from a live handle.
 *
 * Both backup and restore do their SQL work on files staged HERE rather than in
 * cache: `openDatabaseSync`'s `directory` argument is the only other way to open
 * a file outside it, and staging in the default directory keeps every promotion
 * a same-volume copy — no cross-filesystem surprises mid-swap.
 */
export function databasesDir(): string {
  return Paths.dirname(sqlite.databasePath);
}

/** A path inside the databases directory. */
export function databasesPath(fileName: string): string {
  return Paths.join(databasesDir(), fileName);
}

/** Delete every WAL/journal sidecar beside `path`. Missing files are fine. */
export function deleteSidecars(path: string): void {
  for (const sidecar of walSidecarPaths(path)) {
    const file = new File(toFileUri(sidecar));
    if (file.exists) file.delete();
  }
}
