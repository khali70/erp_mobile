import { useMemo } from 'react';
import { voiceNoteRepository } from '@/repositories/voice-note-repository.client';
import type { VoiceNote } from '../types';

export interface ConvertQueue {
  /** True when there is at least one pending note to work through. */
  hasQueue: boolean;
  /** The note the entry screen is currently converting, or null when empty. */
  active: VoiceNote | null;
  /** id of the active note — feed this to `useDocumentForm` so the RIGHT note is
   *  marked processed on save. */
  activeId: string | undefined;
  /** 1-based position of the active note in the queue (0 when empty). */
  index: number;
  /** Total pending notes in the queue. */
  total: number;
  /** id of the next pending note after the active one, or null at the tail. */
  nextId: string | null;
}

/**
 * The convert-queue owner for the New Incoming/Outgoing entry screens. Reads the
 * FIFO pending queue (oldest first) straight from the repository and positions the
 * active note by the `voiceNoteId` nav param — the param IS the active pointer, so
 * a successful save marks exactly the note being worked on, and advancing is just
 * `navigation.setParams({ voiceNoteId: nextId })`.
 *
 * The param note is normally still pending (it was just tapped in the review
 * list); if it has already been processed meanwhile, the active note falls back to
 * the head of what remains, surfacing the next queued note rather than a blank
 * card. Ordering/advance logic lives here, never in the screens.
 */
export function useConvertQueue(voiceNoteId: string | undefined): ConvertQueue {
  // Re-derived whenever the active param changes — that is the one thing that
  // moves while the screen is mounted (a save pops back to the list, and the
  // queue is re-read on the next entry).
  return useMemo(() => {
    const queue = voiceNoteRepository.listPendingQueue();
    if (queue.length === 0) {
      return { hasQueue: false, active: null, activeId: undefined, index: 0, total: 0, nextId: null };
    }
    const paramIdx = voiceNoteId ? queue.findIndex((n) => n.id === voiceNoteId) : -1;
    // Param still pending → work it; already processed/gone → head of the queue.
    const idx = paramIdx >= 0 ? paramIdx : 0;
    const active = queue[idx];
    const next = queue[idx + 1] ?? null;
    return {
      hasQueue: true,
      active,
      activeId: active.id,
      index: idx + 1,
      total: queue.length,
      nextId: next ? next.id : null,
    };
  }, [voiceNoteId]);
}
