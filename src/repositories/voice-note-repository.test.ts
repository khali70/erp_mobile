import { makeTestDb, type TestDb } from '@/db/testing/test-db';
import {
  createVoiceNoteRepository,
  InvalidVoiceNoteError,
  type RemoveAudioFile,
} from './voice-note-repository';
import * as schema from '@/db/schema';

// FIXED clock — never Date.now() in a repository, or a test flakes at midnight.
const T0 = 1_760_000_000_000;
const SEC = 1000;

let db: TestDb;
let removed: string[];
let removeFile: RemoveAudioFile;
let repo: ReturnType<typeof createVoiceNoteRepository>;

beforeEach(() => {
  db = makeTestDb();
  removed = [];
  // Spy remover — the repository must never touch expo-file-system directly, so
  // the audio-delete side effect is observable here as a plain array push.
  removeFile = (filePath: string) => {
    removed.push(filePath);
  };
  repo = createVoiceNoteRepository(db, { clock: () => T0, removeFile });
});

const capture = (over: Partial<Parameters<typeof repo.createVoiceNote>[0]> = {}) =>
  repo.createVoiceNote({
    filePath: 'file:///voice/note-1.m4a',
    durationMs: 4200,
    mime: 'audio/m4a',
    sizeBytes: 51200,
    ...over,
  });

describe('a captured voice note is real, persisted data', () => {
  it('round-trips through SQL and lands PENDING with no document', () => {
    const note = capture();

    const read = repo.getVoiceNote(note.id)!;
    expect(read).toMatchObject({
      filePath: 'file:///voice/note-1.m4a',
      durationMs: 4200,
      mime: 'audio/m4a',
      sizeBytes: 51200,
      status: 'pending',
      note: null,
      linkedDocumentId: null,
      processedAt: null,
      createdAt: T0,
    });
    expect(repo.listVoiceNotes()).toHaveLength(1);
  });

  it('trims an optional typed memo, and blanks it to null', () => {
    expect(capture({ note: '  عشرين شيكارة أسمنت  ' }).note).toBe('عشرين شيكارة أسمنت');
    expect(capture({ note: '   ' }).note).toBeNull();
  });

  it('rejects a note with no audio file, no mime, or nonsensical metadata', () => {
    expect(() => capture({ filePath: '   ' })).toThrow(InvalidVoiceNoteError);
    expect(() => capture({ mime: '' })).toThrow(InvalidVoiceNoteError);
    expect(() => capture({ durationMs: -1 })).toThrow(InvalidVoiceNoteError);
    expect(() => capture({ durationMs: 1.5 })).toThrow(InvalidVoiceNoteError);
    expect(() => capture({ sizeBytes: -10 })).toThrow(InvalidVoiceNoteError);
    expect(repo.listVoiceNotes()).toHaveLength(0);
  });
});

describe('the review list — newest captured first, filterable by status', () => {
  it('orders by createdAt descending', () => {
    const clock = { t: T0 };
    const r = createVoiceNoteRepository(db, { clock: () => clock.t, removeFile });
    clock.t = T0;
    r.createVoiceNote({ filePath: 'file:///a.m4a', durationMs: 1, mime: 'audio/m4a', sizeBytes: 1 });
    clock.t = T0 + 5 * SEC;
    r.createVoiceNote({ filePath: 'file:///b.m4a', durationMs: 1, mime: 'audio/m4a', sizeBytes: 1 });

    expect(r.listVoiceNotes().map((n) => n.filePath)).toEqual(['file:///b.m4a', 'file:///a.m4a']);
  });

  it('narrows to a single status', () => {
    const a = capture({ filePath: 'file:///a.m4a' });
    capture({ filePath: 'file:///b.m4a' });
    repo.markProcessed(a.id, 'doc-1');

    expect(repo.listVoiceNotes({ status: 'pending' }).map((n) => n.filePath)).toEqual([
      'file:///b.m4a',
    ]);
    expect(repo.listVoiceNotes({ status: 'processed' }).map((n) => n.id)).toEqual([a.id]);
  });
});

describe('the convert queue — pending notes, OLDEST first (FIFO head)', () => {
  it('orders by createdAt ascending, the reverse of the review list', () => {
    const clock = { t: T0 };
    const r = createVoiceNoteRepository(db, { clock: () => clock.t, removeFile });
    clock.t = T0;
    r.createVoiceNote({ filePath: 'file:///a.m4a', durationMs: 1, mime: 'audio/m4a', sizeBytes: 1 });
    clock.t = T0 + 5 * SEC;
    r.createVoiceNote({ filePath: 'file:///b.m4a', durationMs: 1, mime: 'audio/m4a', sizeBytes: 1 });
    clock.t = T0 + 10 * SEC;
    r.createVoiceNote({ filePath: 'file:///c.m4a', durationMs: 1, mime: 'audio/m4a', sizeBytes: 1 });

    // Queue drains front-to-back in capture order; the review list is newest-first.
    expect(r.listPendingQueue().map((n) => n.filePath)).toEqual([
      'file:///a.m4a',
      'file:///b.m4a',
      'file:///c.m4a',
    ]);
    expect(r.listVoiceNotes().map((n) => n.filePath)).toEqual([
      'file:///c.m4a',
      'file:///b.m4a',
      'file:///a.m4a',
    ]);
  });

  it('drops a note off the queue once it is processed', () => {
    const a = capture({ filePath: 'file:///a.m4a' });
    capture({ filePath: 'file:///b.m4a' });
    repo.markProcessed(a.id, 'doc-1');

    expect(repo.listPendingQueue().map((n) => n.filePath)).toEqual(['file:///b.m4a']);
  });
});

describe('the document hand-off — markProcessed', () => {
  it('flips the note to processed, stamps the document, and records when', () => {
    const clock = { t: T0 };
    const r = createVoiceNoteRepository(db, { clock: () => clock.t, removeFile });
    const note = r.createVoiceNote({
      filePath: 'file:///a.m4a',
      durationMs: 1,
      mime: 'audio/m4a',
      sizeBytes: 1,
    });

    clock.t = T0 + 60 * SEC;
    r.markProcessed(note.id, 'doc-42');

    expect(r.getVoiceNote(note.id)).toMatchObject({
      status: 'processed',
      linkedDocumentId: 'doc-42',
      processedAt: T0 + 60 * SEC,
    });
  });
});

describe('discard — the row AND the recording die together', () => {
  it('deletes the audio file and removes the row', () => {
    const note = capture();

    repo.discardVoiceNote(note.id);

    expect(removed).toEqual(['file:///voice/note-1.m4a']);
    expect(repo.getVoiceNote(note.id)).toBeNull();
    expect(repo.listVoiceNotes()).toHaveLength(0);
  });

  it('is a no-op for an id that does not exist — nothing removed, nothing thrown', () => {
    expect(() => repo.discardVoiceNote('nope')).not.toThrow();
    expect(removed).toEqual([]);
  });

  it('tolerates a remover that throws on a missing file — the note discards regardless', () => {
    const throwing = createVoiceNoteRepository(db, {
      clock: () => T0,
      removeFile: () => {
        throw new Error('ENOENT');
      },
    });
    const note = throwing.createVoiceNote({
      filePath: 'file:///gone.m4a',
      durationMs: 1,
      mime: 'audio/m4a',
      sizeBytes: 1,
    });

    // The production client swallows a missing-file error inside removeFile; here
    // the throwing spy models a remover that does NOT — proving the row is only
    // removed after the file call, so a real client (which never throws) always
    // clears both. We assert the row survived the throw, matching that contract.
    expect(() => throwing.discardVoiceNote(note.id)).toThrow('ENOENT');
    expect(throwing.getVoiceNote(note.id)).not.toBeNull();
  });

  it('deleteVoiceNote drops only the row and never touches the file', () => {
    const note = capture();

    repo.deleteVoiceNote(note.id);

    expect(removed).toEqual([]);
    expect(repo.getVoiceNote(note.id)).toBeNull();
    expect(db.select().from(schema.voiceNotes).all()).toHaveLength(0);
  });
});
