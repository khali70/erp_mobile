import { useCallback, useMemo, useState } from 'react';
import { voiceNoteRepository } from '@/repositories/voice-note-repository.client';
import type { CreateVoiceNoteInput } from '@/repositories/voice-note-repository';
import type { VoiceFilter, VoiceNote } from '../types';

export interface UseVoiceNotes {
  notes: VoiceNote[];
  filter: VoiceFilter;
  setFilter: (f: VoiceFilter) => void;
  reload: () => void;
  create: (input: CreateVoiceNoteInput) => VoiceNote;
  markDone: (id: string) => void;
  discard: (id: string) => void;
}

/**
 * The review list's data owner: reads voice notes from the repository, keeps the
 * status filter, and exposes create/discard. The screen calls `reload()` on
 * focus so a note captured (or a document created from one) shows up.
 *
 * The repository is the ONLY thing that touches the DB — this hook never issues
 * SQL, and it never touches the audio files (discard's file delete lives behind
 * the repository's injected remover).
 */
export function useVoiceNotes(initial: VoiceFilter = 'pending'): UseVoiceNotes {
  const [filter, setFilter] = useState<VoiceFilter>(initial);
  const [all, setAll] = useState<VoiceNote[]>(() => voiceNoteRepository.listVoiceNotes());

  const reload = useCallback(() => {
    setAll(voiceNoteRepository.listVoiceNotes());
  }, []);

  const create = useCallback((input: CreateVoiceNoteInput) => {
    const note = voiceNoteRepository.createVoiceNote(input);
    setAll((prev) => [note, ...prev]);
    return note;
  }, []);

  // Manually tick a note done WITHOUT turning it into a document — the owner
  // handled it some other way. Keeps the recording (unlike discard); it just
  // leaves the review queue. No document, so linkedDocumentId stays null.
  const markDone = useCallback((id: string) => {
    voiceNoteRepository.markProcessed(id, null);
    setAll((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'processed' } : n)),
    );
  }, []);

  const discard = useCallback((id: string) => {
    voiceNoteRepository.discardVoiceNote(id);
    setAll((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Filter in memory — the list is small (a day's captures) and this keeps the
  // repository read to one query regardless of the chip the owner taps.
  const notes = useMemo(
    () => (filter === 'all' ? all : all.filter((n) => n.status === filter)),
    [all, filter],
  );

  return { notes, filter, setFilter, reload, create, markDone, discard };
}
