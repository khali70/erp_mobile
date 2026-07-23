/**
 * Over-the-air update state — the runtime state machine driven by expo-updates.
 *
 * `unavailable` is not an error: it is the resting state in development and in
 * Expo Go, where `Updates.isEnabled` is false. Every OTA action degrades to a
 * graceful no-op there rather than throwing.
 */
export type UpdateStatus =
  | 'idle'
  | 'unavailable'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'readyToReload'
  | 'upToDate'
  | 'error';

/** The full surface of `useAppUpdates` — the single owner of all expo-updates calls. */
export interface AppUpdates {
  /** Where the check → download → reload machine currently sits. */
  status: UpdateStatus;
  /** Localised, human error text — never a raw stack. Null unless `status === 'error'`. */
  error: string | null;
  /** True once an update is downloaded and staged; it applies on the next cold start. */
  isUpdatePending: boolean;
  /** False in dev / Expo Go — the whole feature is inert. */
  isEnabled: boolean;
  /** Epoch ms of the last completed check, cached in MMKV. Null if never checked. */
  lastCheckedAt: number | null;
  /** The release channel this binary listens on (e.g. "production"). */
  channel: string | null;
  /** Short, display-only build id — the running update's id, or "embedded". */
  versionLabel: string;
  /** True while the "restart to apply" sheet should be shown. */
  promptVisible: boolean;
  /** Check → (if available) download. Idempotent while already checking/downloading. */
  check: () => Promise<void>;
  /** Apply a downloaded update by reloading into it. No-op unless enabled. */
  restart: () => Promise<void>;
  /** Dismiss the "restart to apply" sheet; the update stays staged for next launch. */
  dismissPrompt: () => void;
}
