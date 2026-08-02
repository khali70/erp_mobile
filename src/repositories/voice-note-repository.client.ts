import { File } from 'expo-file-system';
import { db } from '@/db/client';
import { resolveVoiceUri } from '@/features/voice-notes/utils/voiceFilePath';
import { createVoiceNoteRepository, type RemoveAudioFile, type VoiceNoteDb } from './voice-note-repository';

// Deletes the audio file backing a discarded note. MUST NOT throw on a missing
// file — a recording the OS already cleared, or one never written, still has to
// discard cleanly (the repository leans on this). `exists` gates the delete and
// the try/catch is the final backstop.
//
// Resolved BY BASENAME against the live voice dir, not by the stored uri: a note
// whose row came in from a RESTORE carries an absolute path from a different
// install, so deleting the stored uri would miss the file that actually landed
// on this device. The pure repository stays untouched; only this remover resolves.
const removeAudioFile: RemoveAudioFile = (filePath) => {
  try {
    const file = new File(resolveVoiceUri(filePath));
    if (file.exists) file.delete();
  } catch {
    // A recording that is already gone is not an error — the row still dies.
  }
};

// Production singleton bound to the app's expo-sqlite instance and the real
// filesystem. Screens/hooks import this; tests build their own repo over an
// in-memory db via the factory, injecting a spy remover.
export const voiceNoteRepository = createVoiceNoteRepository(db as unknown as VoiceNoteDb, {
  removeFile: removeAudioFile,
});
