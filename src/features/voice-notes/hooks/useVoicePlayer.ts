import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

// How often the shared player reports its position back to React. Tight enough
// for a smooth WhatsApp-style progress bar, loose enough not to thrash the small
// review list (a day's captures).
const TICK_MS = 200;

// ONE native AudioPlayer for the whole app, created lazily on first use and
// NEVER released. `useAudioPlayer` releases its player when the owning component
// unmounts; with the same hook now living on the list AND the convert-queue card,
// navigating between them released one player out from under an in-flight call —
// the "Cannot use shared object that was already released" crash (the freed
// player surfaces as a raw Integer id that can't be cast back to an AudioPlayer).
// A single app-lifetime player cannot be released by navigation, so that race is
// gone by construction — and because there is only ever one player, the
// single-clip-at-a-time contract holds across every screen for free.
let sharedInstance: AudioPlayer | null = null;
function sharedPlayer(): AudioPlayer {
  if (!sharedInstance) {
    sharedInstance = createAudioPlayer(null, { updateInterval: TICK_MS });
  }
  return sharedInstance;
}

// `activeId` is app-global too, so the list and the queue card agree on which
// note the shared player is on. A tiny external store (not React state) because
// the value must be read/written from module-level callbacks and shared across
// every mounted `useVoicePlayer`.
let activeIdValue: string | null = null;
const activeIdListeners = new Set<() => void>();
function setActiveId(id: string | null) {
  if (activeIdValue === id) return;
  activeIdValue = id;
  activeIdListeners.forEach((l) => l());
}
function subscribeActiveId(listener: () => void) {
  activeIdListeners.add(listener);
  return () => {
    activeIdListeners.delete(listener);
  };
}
function getActiveId() {
  return activeIdValue;
}

export interface VoicePlayer {
  /**
   * id of the note LOADED in the shared player — playing OR paused mid-clip — or
   * null when nothing is loaded. The progress bar tracks this note; a paused note
   * keeps its position, unlike `playingId` which clears the moment it pauses.
   */
  activeId: string | null;
  /** id of the note actually PLAYING right now, or null when paused/stopped. */
  playingId: string | null;
  /** Playback position of the active note in ms (0 when nothing is active). */
  positionMs: number;
  /** Total duration the player reports for the active note in ms (0 until known). */
  durationMs: number;
  /** Start `id` (from its file uri), or toggle play/pause if it is the active one. */
  toggle: (id: string, uri: string) => void;
  /**
   * Seek within `id` to `ms`. If `id` is not the active note it is loaded first
   * and played from the seeked position — seeking a row is also how you start it.
   */
  seek: (id: string, uri: string, ms: number) => void;
  /** Stop whatever is loaded (used on unmount / navigation away). */
  stop: () => void;
}

/**
 * THE single owner of playback for the voice-notes list AND the convert-queue
 * player. ONE AudioPlayer is shared across every row, so starting a note
 * necessarily stops the previous one — only one can ever play at a time, by
 * construction, not by bookkeeping.
 *
 * Rows read `activeId`/`playingId` for their icon and `positionMs`/`durationMs`
 * for their seek bar; they never touch the player directly. `activeId` survives a
 * pause so a half-played clip keeps its progress fill (the play icon returns, the
 * position does not reset) — the WhatsApp behaviour.
 */
export function useVoicePlayer(): VoicePlayer {
  const player = sharedPlayer();
  const status = useAudioPlayerStatus(player);
  const activeId = useSyncExternalStore(subscribeActiveId, getActiveId);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
  // Mirror the live playing flag into a ref so `toggle` can decide play-vs-pause
  // without depending on `status.playing` (which changes every tick and would
  // rebuild the callback constantly).
  const playingRef = useRef(false);
  playingRef.current = status.playing;

  // Every call into the shared player is guarded on BOTH failure shapes:
  //  - a synchronous throw (`play`/`pause`/`replace` are sync native functions), and
  //  - a rejected promise (`seekTo` is an async native function whose argument
  //    conversion runs later on the main queue, so its failure rejects rather than
  //    throws and a plain try/catch would miss it — the "has been rejected" form).
  // A never-released shared player should not fail here anymore, but not-ready /
  // no-source calls can still error and there is nothing to do about them, so
  // swallow both forms and keep the UI from red-boxing.
  const safe = useCallback((fn: () => unknown) => {
    try {
      const result = fn();
      if (result != null && typeof (result as PromiseLike<unknown>).then === 'function') {
        Promise.resolve(result).catch(() => {});
      }
    } catch {
      // player not ready / no source — ignore.
    }
  }, []);

  // When a clip reaches its end, drop the active id so the row falls back to the
  // play icon and its progress bar resets to zero.
  useEffect(() => {
    if (status.didJustFinish) setActiveId(null);
  }, [status.didJustFinish]);

  const toggle = useCallback(
    (id: string, uri: string) => {
      if (activeRef.current === id) {
        // Same note: flip between play and pause, keeping it loaded either way.
        safe(() => (playingRef.current ? player.pause() : player.play()));
        return;
      }
      // Point the shared player at this note and start from the top. `replace`
      // swaps the source in place; seekTo(0) covers replaying the same clip. Each
      // call is guarded on its own so the async `seekTo` promise is caught too.
      safe(() => player.replace({ uri }));
      safe(() => player.seekTo(0));
      safe(() => player.play());
      setActiveId(id);
    },
    [player, safe],
  );

  const seek = useCallback(
    (id: string, uri: string, ms: number) => {
      const seconds = Math.max(0, ms) / 1000;
      if (activeRef.current === id) {
        // Active note: jump in place, preserving whether it was playing or paused.
        safe(() => player.seekTo(seconds));
        return;
      }
      // A non-active row: load it and play FROM the seeked position — scrubbing a
      // stopped row is also how you start it.
      safe(() => player.replace({ uri }));
      safe(() => player.seekTo(seconds));
      safe(() => player.play());
      setActiveId(id);
    },
    [player, safe],
  );

  const stop = useCallback(() => {
    safe(() => player.pause());
    setActiveId(null);
  }, [player, safe]);

  // NOTE: no pause-on-unmount effect. The shared player is app-lifetime and must
  // NOT be torn down when a screen unmounts; callers stop it explicitly (blur
  // cleanup / convert / discard) via `stop()`.

  const isPlaying = activeId !== null && status.playing;
  return {
    activeId,
    playingId: isPlaying ? activeId : null,
    positionMs: activeId !== null ? Math.max(0, Math.round(status.currentTime * 1000)) : 0,
    durationMs: activeId !== null ? Math.max(0, Math.round(status.duration * 1000)) : 0,
    toggle,
    seek,
    stop,
  };
}
