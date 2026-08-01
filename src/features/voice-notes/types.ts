import type { VoiceNote } from '@/repositories/voice-note-repository';

export type { VoiceNote, VoiceNoteStatus } from '@/repositories/voice-note-repository';

/** The status filter the review screen offers. 'all' is the union. */
export type VoiceFilter = 'pending' | 'processed' | 'all';

/** Microphone permission, as the recorder hook projects it. */
export type MicPermission = 'granted' | 'denied' | 'undetermined';

/**
 * What `stop()` hands back after a recording is persisted to local storage — the
 * exact shape `voiceNoteRepository.createVoiceNote` needs, minus the typed memo.
 */
export interface PersistedRecording {
  filePath: string;
  durationMs: number;
  mime: string;
  sizeBytes: number;
}

/** A note enriched with its live playback state, for the row UI. */
export interface VoiceNoteRowModel {
  note: VoiceNote;
  /** True while THIS note is the one actually playing. */
  isPlaying: boolean;
  /** Live playback position in ms for this note (0 unless it is the active one). */
  positionMs: number;
}
