import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Lazily created singleton player. One decoded buffer, replayed per scan —
// cheaper and lower-latency than spawning a player each time.
let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(require('../../assets/scan-beep.wav'));
    // A scanner beep should sound even with the ringer/silent switch off.
    void setAudioModeAsync({ playsInSilentMode: true });
  }
  return player;
}

/** Short confirmation beep for a successful barcode scan. Fire-and-forget. */
export function playScanBeep(): void {
  try {
    const p = getPlayer();
    void p.seekTo(0); // rewind so rapid successive scans each beep
    p.play();
  } catch {
    // Audio is non-critical; never let a beep failure break scanning.
  }
}
