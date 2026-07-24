import { BackHandler, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as engine from './restore-engine';
import { expoRestoreIo } from './restore-io';
import type { BackupFormat } from './backup-format';

/**
 * RESTORE, as the app uses it — the picker, the restart, and the engine bound to
 * the phone's io.
 *
 * The sequence itself (validate → snapshot → close → clear WAL → copy → migrate)
 * lives in ./restore-engine, expressed against a port so the suite can run it
 * end to end against real SQLite instead of reviewing it by eye; ./restore-io is
 * the expo binding. This file is the seam between them, plus the two things that
 * are genuinely platform behaviour: choosing a file and restarting the process.
 */

export type {
  RestorePreview,
  RestoreResult,
  RestoreMarker,
  RestoreMarkerEntry,
  RestoreErrorCode,
} from './restore-engine';
export { RestoreError } from './restore-engine';
export type { BackupFormat, RestoreTarget } from './backup-format';

// ---------------------------------------------------------------------------
// PICK
// ---------------------------------------------------------------------------

/**
 * Open the system document picker. Resolves to `null` when the owner backs out
 * — a cancel is a normal, silent no-op, never an error dialog.
 *
 * The ANY-type filter is on purpose: Android reports `.db` and `.zip` files with
 * a mixture of MIME types (`application/octet-stream`, `application/vnd.sqlite3`,
 * or nothing at all) depending on the provider, so filtering by MIME hides the
 * very file the owner is looking for. The real filter is the header + schema
 * check, which runs on a staged copy and cannot be fooled by a file extension.
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
// THE ENGINE, BOUND
// ---------------------------------------------------------------------------

export function inspectBackupFile(
  slot: BackupFormat,
  asset: DocumentPickerAsset,
): Promise<engine.RestorePreview> {
  return engine.inspectCandidate(expoRestoreIo, slot, {
    path: asset.uri,
    name: asset.name,
    size: asset.size ?? null,
  });
}

export function applyRestore(preview: engine.RestorePreview): Promise<engine.RestoreResult> {
  return engine.applyRestore(expoRestoreIo, preview);
}

/** Drop a staged candidate the owner declined. Safe to call at any time. */
export function discardStagedCandidate(): void {
  engine.discardStagedCandidate(expoRestoreIo);
}

export function detectInterruptedRestore(): engine.RestoreMarker | null {
  return engine.detectInterruptedRestore(expoRestoreIo);
}

export function isRollbackAvailable(marker: engine.RestoreMarker): boolean {
  return engine.isRollbackAvailable(expoRestoreIo, marker);
}

export function rollbackInterruptedRestore(marker: engine.RestoreMarker): Promise<void> {
  return engine.rollbackInterruptedRestore(expoRestoreIo, marker);
}

export function discardInterruptedRestore(): void {
  engine.discardInterruptedRestore(expoRestoreIo);
}

// ---------------------------------------------------------------------------
// RESTART
// ---------------------------------------------------------------------------

/**
 * Whether this build can restart itself.
 *
 * `expo-updates` IS installed, and `Updates.reloadAsync()` is the supported way
 * to restart an Expo app — but it is disabled in Expo Go and in a dev client
 * without an update URL, which is exactly where this flow gets exercised most.
 * So the capability is read at runtime rather than assumed, and every caller has
 * a fallback: the success dialog stays non-dismissible and keeps telling the
 * owner to fully close and reopen the app, which is the honest thing to show
 * when the alternative is letting screens read from a handle closed under them.
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
