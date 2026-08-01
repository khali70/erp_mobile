import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';

// Injectable so the same code runs on expo-sqlite (prod) and better-sqlite3
// (tests). Any sync Drizzle SQLite db with our schema satisfies it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VoiceNoteDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

/** The lifecycle of a captured memo. */
export type VoiceNoteStatus = 'pending' | 'processed' | 'discarded';

/**
 * Deletes the audio file backing a voice note. INJECTED — the repository must
 * stay free of `expo-file-system` so it can run under better-sqlite3 in the test
 * suite (same rule the whole data layer follows). The client binds the real
 * filesystem deleter; a test binds a spy. MUST NOT throw on a missing file — a
 * note whose recording was already cleared up still has to discard cleanly.
 */
export type RemoveAudioFile = (filePath: string) => void;

export interface CreateVoiceNoteRepoOptions {
  /** Never `Date.now()` in a repository — inject it, or the tests flake. */
  clock?: () => number;
  removeFile?: RemoveAudioFile;
}

export interface CreateVoiceNoteInput {
  /** file:// URI of the persisted recording on local storage. */
  filePath: string;
  /** Length of the recording in milliseconds. */
  durationMs: number;
  /** e.g. 'audio/m4a'. */
  mime: string;
  /** File size in bytes (0 when unknown). */
  sizeBytes: number;
  /** Optional typed memo alongside the audio. */
  note?: string | null;
}

/** One voice note, as it comes back out of the table. */
export interface VoiceNote {
  id: string;
  filePath: string;
  durationMs: number;
  mime: string;
  sizeBytes: number;
  status: VoiceNoteStatus;
  note: string | null;
  linkedDocumentId: string | null;
  createdAt: number;
  processedAt: number | null;
}

export interface ListVoiceNotesFilter {
  status?: VoiceNoteStatus;
}

/** Thrown when a voice note would be written with nonsensical metadata. */
export class InvalidVoiceNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVoiceNoteError';
  }
}

function assertValid(input: CreateVoiceNoteInput): void {
  if (!input.filePath.trim()) {
    throw new InvalidVoiceNoteError('a voice note must point at an audio file (filePath is required)');
  }
  if (!input.mime.trim()) {
    throw new InvalidVoiceNoteError('a voice note must carry a mime type');
  }
  if (!Number.isInteger(input.durationMs) || input.durationMs < 0) {
    throw new InvalidVoiceNoteError(
      `durationMs must be a non-negative integer (got ${input.durationMs})`,
    );
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new InvalidVoiceNoteError(
      `sizeBytes must be a non-negative integer (got ${input.sizeBytes})`,
    );
  }
}

/**
 * VOICE NOTES — the capture-now / process-later buffer that sits in front of the
 * documents feature.
 *
 * This repository owns ONLY the metadata table. The audio bytes are a filesystem
 * concern (a voice memo is a standalone media file expo-audio plays straight from
 * a URI), so the ONE place this file touches them is through the injected
 * `removeFile` — called on discard so the row and its recording die together. The
 * document a note becomes is NEVER created here: the feature hands the note off
 * into the existing New Incoming/Outgoing flow, which calls `markProcessed` on a
 * successful save. This module does not import the document repository, and does
 * not touch WAC costing or stock.
 *
 * `clock` and `removeFile` are INJECTED — never `Date.now()` or `expo-file-system`
 * inside a repository, or the suite cannot run it against better-sqlite3.
 */
export function createVoiceNoteRepository(db: VoiceNoteDb, opts: CreateVoiceNoteRepoOptions = {}) {
  const clock = opts.clock ?? now;
  const removeFile: RemoveAudioFile = opts.removeFile ?? (() => {});
  const live = isNull(schema.voiceNotes.deletedAt);

  function toVoiceNote(r: schema.VoiceNoteRow): VoiceNote {
    return {
      id: r.id,
      filePath: r.filePath,
      durationMs: r.durationMs,
      mime: r.mime,
      sizeBytes: r.sizeBytes,
      status: r.status as VoiceNoteStatus,
      note: r.note,
      linkedDocumentId: r.linkedDocumentId,
      createdAt: r.createdAt,
      processedAt: r.processedAt,
    };
  }

  const api = {
    /**
     * The review list — newest captured first. An optional status filter narrows
     * it (the screen defaults to 'pending'). Soft-deleted rows never appear.
     */
    listVoiceNotes(filter: ListVoiceNotesFilter = {}): VoiceNote[] {
      const where = filter.status
        ? and(live, eq(schema.voiceNotes.status, filter.status))
        : live;
      return db
        .select()
        .from(schema.voiceNotes)
        .where(where)
        .orderBy(desc(schema.voiceNotes.createdAt))
        .all()
        .map(toVoiceNote);
    },

    /**
     * THE CONVERT QUEUE — pending notes ordered OLDEST first (createdAt ASC), so
     * the head of the list is the next memo to process. Deliberately the reverse
     * of `listVoiceNotes` (newest-first, for review): a work queue is drained
     * front-to-back in the order the notes were captured, first in first out.
     * Soft-deleted and already-processed rows never appear.
     */
    listPendingQueue(): VoiceNote[] {
      return db
        .select()
        .from(schema.voiceNotes)
        .where(and(live, eq(schema.voiceNotes.status, 'pending')))
        .orderBy(asc(schema.voiceNotes.createdAt))
        .all()
        .map(toVoiceNote);
    },

    getVoiceNote(id: string): VoiceNote | null {
      const row = db
        .select()
        .from(schema.voiceNotes)
        .where(and(eq(schema.voiceNotes.id, id), live))
        .get();
      return row ? toVoiceNote(row) : null;
    },

    /** Persist a freshly captured recording as a PENDING note. */
    createVoiceNote(input: CreateVoiceNoteInput): VoiceNote {
      assertValid(input);
      const ts = clock();
      const row: schema.NewVoiceNoteRow = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        filePath: input.filePath.trim(),
        durationMs: input.durationMs,
        mime: input.mime.trim(),
        sizeBytes: input.sizeBytes,
        status: 'pending',
        note: input.note?.trim() || null,
        linkedDocumentId: null,
        processedAt: null,
      };
      db.insert(schema.voiceNotes).values(row).run();
      return toVoiceNote(row as schema.VoiceNoteRow);
    },

    /**
     * Flip a note to PROCESSED. Called two ways: by the New Incoming/Outgoing
     * screen after a successful save (passing the new document id), or by the
     * owner manually ticking a note done with no document (`linkedDocumentId`
     * null). Idempotent by intent: a processed note is not meant to be converted
     * again, and the UI drops the convert/done actions once it is processed.
     */
    markProcessed(id: string, linkedDocumentId: string | null = null): void {
      const ts = clock();
      db.update(schema.voiceNotes)
        .set({
          status: 'processed',
          linkedDocumentId,
          processedAt: ts,
          updatedAt: ts,
        })
        .where(eq(schema.voiceNotes.id, id))
        .run();
    },

    /**
     * DISCARD — throw the note away. Deletes the audio file (via the injected
     * remover, which tolerates a missing file) AND removes the DB row, so nothing
     * of the recording survives. A no-op for an id that does not exist.
     */
    discardVoiceNote(id: string): void {
      const note = api.getVoiceNote(id);
      if (!note) return;
      removeFile(note.filePath);
      db.delete(schema.voiceNotes).where(eq(schema.voiceNotes.id, id)).run();
    },

    /**
     * Hard-delete the row ONLY — the lower-level primitive that leaves the audio
     * file untouched (used when the file has already been dealt with elsewhere).
     * Discarding is what the owner reaches for; this is for internal cleanup.
     */
    deleteVoiceNote(id: string): void {
      db.delete(schema.voiceNotes).where(eq(schema.voiceNotes.id, id)).run();
    },
  };

  return api;
}

export type VoiceNoteRepository = ReturnType<typeof createVoiceNoteRepository>;
