import { File } from 'expo-file-system';
import { db } from '@/db/client';
import { createVoiceNoteRepository, type RemoveAudioFile, type VoiceNoteDb } from './voice-note-repository';

// Deletes the audio file backing a discarded note. MUST NOT throw on a missing
// file — a recording the OS already cleared, or one never written, still has to
// discard cleanly (the repository leans on this). `exists` gates the delete and
// the try/catch is the final backstop.
const removeAudioFile: RemoveAudioFile = (filePath) => {
  try {
    const file = new File(filePath);
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
