import { Directory, File, Paths } from 'expo-file-system';

/**
 * WHERE VOICE RECORDINGS LIVE, and how to find one again after a RESTORE.
 *
 * A captured memo is a standalone `.m4a` on the filesystem (never in SQLite),
 * kept in ONE folder under the document dir so the recordings are easy to back
 * up and clean up as a group. The repository stores each note's `filePath` as an
 * ABSOLUTE `file://` uri — which is fine until a backup is restored onto a
 * DIFFERENT install, where the app container path differs (guaranteed on iOS,
 * often on Android). The stored uri then points at a directory that no longer
 * exists, even once the audio itself has been unpacked from the backup zip.
 *
 * The fix needs no DB migration: the audio always lands under the SAME BASENAME
 * it had in the backup, so playback and delete resolve a stored path to the
 * CURRENT device's voice dir by its basename at read time. `resolveVoiceUri`
 * below is that resolution, and it is the only thing the rest of the feature
 * needs to call. Kept tiny and pure-ish — only expo-file-system, no repositories.
 */
export const VOICE_DIR = 'voice-notes';

/** The last path segment of a filesystem path or `file://` uri. */
export function basename(filePathOrUri: string): string {
  const trimmed = filePathOrUri.replace(/[/\\]+$/, '');
  const segments = trimmed.split(/[/\\]/);
  return segments[segments.length - 1] ?? '';
}

/**
 * Map any stored `filePath` to the audio file as it sits on THIS device: the
 * voice dir under the current document dir, plus the stored path's basename. A
 * never-restored row resolves to itself (same dir, same name); a restored row
 * resolves to wherever the backup's audio was unpacked under the same basename.
 */
export function resolveVoiceUri(filePath: string): string {
  return new File(new Directory(Paths.document, VOICE_DIR), basename(filePath)).uri;
}
