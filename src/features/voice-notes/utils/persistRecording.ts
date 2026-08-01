import { Directory, File, Paths } from 'expo-file-system';
import { newId } from '@/utils/id';
import type { PersistedRecording } from '../types';

// A voice memo is a standalone media file expo-audio plays straight from a URI,
// so — like receipt photos, unlike receipt bytes — it lives on the filesystem,
// NOT in SQLite. expo-audio records into the CACHE dir, which the OS may purge;
// we move it into the DOCUMENT dir (safe from eviction) under one folder so the
// recordings are easy to back up and clean up as a group.
const VOICE_DIR = 'voice-notes';

/**
 * Move a freshly stopped recording out of the cache and into permanent storage,
 * returning the metadata the repository persists. The source uri comes from
 * `recorder.uri` after `stop()`. Throws if the recorder produced no file.
 */
export function persistRecording(sourceUri: string, mime: string): PersistedRecording {
  const dir = new Directory(Paths.document, VOICE_DIR);
  if (!dir.exists) dir.create({ intermediates: true });

  const src = new File(sourceUri);
  const extension = src.extension || '.m4a';
  const dest = new File(dir, `${newId()}${extension}`);

  // moveSync updates nothing we rely on beyond placing the bytes at `dest`; we
  // read the size back off `dest` afterwards (its `size` is null until it exists).
  src.moveSync(dest);

  return {
    filePath: dest.uri,
    durationMs: 0, // filled in by the caller from the recorder's measured length
    mime,
    sizeBytes: dest.size ?? 0,
  };
}

/**
 * Delete a file if it is there, swallowing a missing-file error. Used to drop a
 * too-short or cancelled recording's cache bytes without ever throwing.
 */
export function deleteFileQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone — the outcome we wanted anyway.
  }
}
