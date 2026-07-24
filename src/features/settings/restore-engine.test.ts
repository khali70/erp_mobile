import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { zipSync } from 'fflate';
import { buildBackupZip, ZIP_ENTRY_ATTACHMENTS, ZIP_ENTRY_ERP } from './backup-format';
import {
  RestoreError,
  applyRestore,
  detectInterruptedRestore,
  discardStagedCandidate,
  inspectCandidate,
  isRollbackAvailable,
  rollbackInterruptedRestore,
  type RestoreMarker,
  type RestorePreview,
} from './restore-engine';
import {
  attachmentRows,
  buildMergedFixture,
  createHarness,
  dumpDatabase,
  seedAttachments,
  seedLedger,
  sidecarFiles,
  stagedLeftovers,
  tableNames,
  type Harness,
} from './testing/restore-harness';

/**
 * RESTORE, end to end, against real SQLite files on a real filesystem.
 *
 * The zip is the easy half to prove: it either has both entries or it does not.
 * This file covers the half that can lose a shop's books — the swap, the
 * rollback, and every rejection that has to happen BEFORE a live byte moves.
 *
 * Two rules run through all of it:
 *  • a rejection is only proven if the live databases are byte-for-byte
 *    unchanged afterwards. An error message alone proves nothing about safety.
 *  • a failure mid-restore is only survivable if BOTH databases come back, and
 *    if nothing — no sidecar, no staged candidate — is left behind either way.
 */

let h: Harness;

beforeEach(() => {
  h = createHarness();
});

afterEach(() => {
  h.cleanup();
});

/** The live pair, seeded with the data a restore is supposed to destroy. */
function seedLive(): void {
  seedLedger(h.livePath('erp'), { documents: 1, items: 1 });
  seedAttachments(h.livePath('attachments'), 1);
  h.reopenLive();
}

/** A backup source pair, with different, recognisable contents. */
function seedBackupSource(): { ledger: string; attachments: string } {
  const ledger = path.join(h.pickDir, 'source-erp.db');
  const attachments = path.join(h.pickDir, 'source-attachments.db');
  seedLedger(ledger, { documents: 4, items: 6 });
  seedAttachments(attachments, 3);
  return { ledger, attachments };
}

function writeZip(name: string, entries: Record<string, Uint8Array>): string {
  const file = path.join(h.pickDir, name);
  fs.writeFileSync(file, zipSync(entries));
  return file;
}

const picked = (file: string) => ({
  path: file,
  name: path.basename(file),
  size: null,
});

/** Checkpoint, then read both live files — the exact bytes a restore risks. */
async function liveBytes(): Promise<{ erp: Buffer; attachments: Buffer }> {
  await h.io.checkpointLive('erp');
  await h.io.checkpointLive('attachments');
  return {
    erp: fs.readFileSync(h.livePath('erp')),
    attachments: fs.readFileSync(h.livePath('attachments')),
  };
}

/**
 * Pick a file, expect a specific typed refusal, and prove nothing of the
 * owner's was touched — the file bytes AND the absence of leftovers.
 */
async function expectRejected(
  slot: Parameters<typeof inspectCandidate>[1],
  file: string,
  code: string,
  extra?: { actualFormat?: string },
): Promise<void> {
  const before = await liveBytes();
  let thrown: unknown;
  try {
    await inspectCandidate(h.io, slot, picked(file));
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(RestoreError);
  const error = thrown as RestoreError;
  expect(error.code).toBe(code);
  if (extra?.actualFormat) expect(error.actualFormat).toBe(extra.actualFormat);

  const after = await liveBytes();
  expect(after.erp.equals(before.erp)).toBe(true);
  expect(after.attachments.equals(before.attachments)).toBe(true);
  expect(h.marker.value).toBeNull();
  // The live handles are still open here, so their own `-wal` is expected; what
  // must NOT survive a refusal is the candidate we staged.
  expect(stagedLeftovers(h.dbDir)).toEqual([]);
}

// ---------------------------------------------------------------------------
// ROUND TRIPS — backup out, restore in, nothing changed on the way
// ---------------------------------------------------------------------------

describe('round trip: zip', () => {
  it('restores every ledger row and every receipt blob byte-identically', async () => {
    seedLive();
    const source = seedBackupSource();
    const expectedLedger = dumpDatabase(source.ledger);
    const expectedAttachments = attachmentRows(source.attachments);

    // The production archive builder, on the production entry names.
    const archive = path.join(h.pickDir, 'rafuf-backup-2026-01-01-00-00-00.zip');
    fs.writeFileSync(
      archive,
      buildBackupZip(
        new Uint8Array(fs.readFileSync(source.ledger)),
        new Uint8Array(fs.readFileSync(source.attachments)),
      ),
    );

    const preview = await inspectCandidate(h.io, 'zip', picked(archive));
    expect(preview.format).toBe('zip');
    expect(preview.hasAttachments).toBe(true);
    expect(preview.counts.documents).toBe(4);
    expect(preview.counts.items).toBe(6);
    expect(preview.counts.attachments).toBe(3);

    const result = await applyRestore(h.io, preview);
    expect(result.restored).toEqual(['erp', 'attachments']);
    expect(result.requiresRestart).toBe(true);

    expect(dumpDatabase(h.livePath('erp'))).toEqual(expectedLedger);
    const restored = attachmentRows(h.livePath('attachments'));
    expect(restored).toHaveLength(3);
    restored.forEach((row, i) => {
      expect(row.id).toBe(expectedAttachments[i].id);
      expect(row.bytes.equals(expectedAttachments[i].bytes)).toBe(true);
    });
  });

  it('leaves no sidecars, no staged candidates and no marker behind', async () => {
    seedLive();
    const source = seedBackupSource();
    const archive = path.join(h.pickDir, 'backup.zip');
    fs.writeFileSync(
      archive,
      buildBackupZip(
        new Uint8Array(fs.readFileSync(source.ledger)),
        new Uint8Array(fs.readFileSync(source.attachments)),
      ),
    );

    await applyRestore(h.io, await inspectCandidate(h.io, 'zip', picked(archive)));

    // Checked before anything reads the databases back: opening a WAL-mode file
    // recreates its `-shm`, which would mask exactly the bug this guards.
    expect(sidecarFiles(h.dbDir)).toEqual([]);
    expect(stagedLeftovers(h.dbDir)).toEqual([]);
    expect(h.marker.value).toBeNull();
  });

  it('restores a zip that carries no receipts, and says so', async () => {
    seedLive();
    const source = seedBackupSource();
    const beforeAttachments = (await liveBytes()).attachments;
    const archive = writeZip('ledger-only.zip', {
      [ZIP_ENTRY_ERP]: new Uint8Array(fs.readFileSync(source.ledger)),
    });

    const preview = await inspectCandidate(h.io, 'zip', picked(archive));
    expect(preview.hasAttachments).toBe(false);

    const result = await applyRestore(h.io, preview);
    // The receipts database is NOT touched — there was nothing to put in it.
    expect(result.restored).toEqual(['erp']);
    expect(fs.readFileSync(h.livePath('attachments')).equals(beforeAttachments)).toBe(true);
  });
});

describe('round trip: merged .db written by the older build', () => {
  it('splits the payload back out and restores both halves intact', async () => {
    seedLive();
    const source = seedBackupSource();
    const expectedLedger = dumpDatabase(source.ledger);
    const expectedAttachments = attachmentRows(source.attachments);

    const merged = path.join(h.pickDir, 'rafuf-backup-old.db');
    buildMergedFixture(merged, source.ledger, source.attachments);

    const preview = await inspectCandidate(h.io, 'merged', picked(merged));
    expect(preview.counts.documents).toBe(4);
    expect(preview.counts.attachments).toBe(3);
    expect(preview.createdAt).toBe(1_700_000_000_000);

    const result = await applyRestore(h.io, preview);
    expect(result.restored).toEqual(['erp', 'attachments']);
    expect(sidecarFiles(h.dbDir)).toEqual([]);
    expect(stagedLeftovers(h.dbDir)).toEqual([]);

    // The backup-only artifacts are gone: the restored ledger is in exactly the
    // shape a never-restored one has, or the next backup merges a stale copy of
    // the receipts into itself.
    const tables = tableNames(h.livePath('erp'));
    expect(tables).not.toContain('attachments');
    expect(tables).not.toContain('backup_meta');
    expect(dumpDatabase(h.livePath('erp'))).toEqual(expectedLedger);

    const restored = attachmentRows(h.livePath('attachments'));
    expect(restored).toHaveLength(3);
    restored.forEach((row, i) => {
      expect(row.bytes.equals(expectedAttachments[i].bytes)).toBe(true);
    });
  });
});

describe('round trip: bare ledger .db', () => {
  it('restores the books, warns that receipts are missing, and leaves them alone', async () => {
    seedLive();
    const source = seedBackupSource();
    const before = await liveBytes();

    const preview = await inspectCandidate(h.io, 'erp', picked(source.ledger));
    expect(preview.hasAttachments).toBe(false);
    expect(preview.counts.attachments).toBe(0);

    const result = await applyRestore(h.io, preview);
    expect(result.restored).toEqual(['erp']);
    expect(dumpDatabase(h.livePath('erp'))).toEqual(dumpDatabase(source.ledger));
    // The receipts on the phone still belong to the OLD books — that is what the
    // ledger-only warning in the UI is about, and it must be true.
    expect(fs.readFileSync(h.livePath('attachments')).equals(before.attachments)).toBe(true);
  });
});

describe('round trip: bare attachments .db', () => {
  it('restores receipts without touching the books', async () => {
    seedLive();
    const source = seedBackupSource();
    const before = await liveBytes();

    const preview = await inspectCandidate(h.io, 'attachments', picked(source.attachments));
    const result = await applyRestore(h.io, preview);

    expect(result.restored).toEqual(['attachments']);
    expect(fs.readFileSync(h.livePath('erp')).equals(before.erp)).toBe(true);
    expect(attachmentRows(h.livePath('attachments'))).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// REJECTIONS — the typed code, AND the live bytes untouched
// ---------------------------------------------------------------------------

describe('rejections', () => {
  beforeEach(() => {
    seedLive();
  });

  it('refuses a file that is not SQLite at all', async () => {
    const file = path.join(h.pickDir, 'holiday.jpg');
    fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]));
    await expectRejected('erp', file, 'not-sqlite');
  });

  it('refuses a file that is not an archive when a full backup was chosen', async () => {
    const file = path.join(h.pickDir, 'notes.txt');
    fs.writeFileSync(file, 'this is not a backup');
    await expectRejected('zip', file, 'not-zip');
  });

  it('refuses an older merged .db picked in the archive slot, by its own name', async () => {
    const source = seedBackupSource();
    const merged = path.join(h.pickDir, 'rafuf-backup-old.db');
    buildMergedFixture(merged, source.ledger, source.attachments);
    await expectRejected('zip', merged, 'not-zip');
  });

  it('refuses an archive with no erp.db in it', async () => {
    const source = seedBackupSource();
    const archive = writeZip('no-ledger.zip', {
      [ZIP_ENTRY_ATTACHMENTS]: new Uint8Array(fs.readFileSync(source.attachments)),
    });
    await expectRejected('zip', archive, 'zip-missing-ledger');
  });

  it('refuses an archive whose erp.db is not this app’s ledger', async () => {
    const source = seedBackupSource();
    const archive = writeZip('wrong-ledger.zip', {
      // The receipts database, misfiled under the ledger's entry name.
      [ZIP_ENTRY_ERP]: new Uint8Array(fs.readFileSync(source.attachments)),
    });
    await expectRejected('zip', archive, 'zip-missing-ledger');
  });

  it('refuses a real SQLite database that is not ours', async () => {
    const file = path.join(h.pickDir, 'someone-else.db');
    const db = new Database(file);
    db.exec('CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT);');
    db.close();
    await expectRejected('erp', file, 'unknown-schema');
  });

  it('refuses one of ours in the wrong slot, and names what it actually is', async () => {
    const source = seedBackupSource();
    await expectRejected('erp', source.attachments, 'wrong-slot', {
      actualFormat: 'attachments',
    });
    await expectRejected('attachments', source.ledger, 'wrong-slot', {
      actualFormat: 'erp',
    });
  });

  it('refuses a backup written by a NEWER build', async () => {
    const source = seedBackupSource();
    const newer = path.join(h.pickDir, 'from-the-future.db');
    fs.copyFileSync(source.ledger, newer);
    const db = new Database(newer);
    db.exec('PRAGMA user_version = 99;');
    db.close();
    await expectRejected('erp', newer, 'schema-too-new');
  });

  it('refuses a merged file whose format version this build cannot take apart', async () => {
    const source = seedBackupSource();
    const merged = path.join(h.pickDir, 'future-merged.db');
    buildMergedFixture(merged, source.ledger, source.attachments, {
      formatVersion: 99,
    });
    await expectRejected('merged', merged, 'schema-too-new');
  });

  it('refuses a file that vanished between the pick and the check', async () => {
    await expectRejected('erp', path.join(h.pickDir, 'gone.db'), 'file-missing');
  });

  it('deletes the staged candidate when the owner declines the preview', async () => {
    const source = seedBackupSource();
    await inspectCandidate(h.io, 'erp', picked(source.ledger));
    expect(stagedLeftovers(h.dbDir)).not.toEqual([]); // staged, awaiting confirmation
    discardStagedCandidate(h.io);
    expect(stagedLeftovers(h.dbDir)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ROLLBACK AND INTERRUPTION
// ---------------------------------------------------------------------------

async function stagedZipPreview(): Promise<RestorePreview> {
  const source = seedBackupSource();
  const archive = path.join(h.pickDir, 'backup.zip');
  fs.writeFileSync(
    archive,
    buildBackupZip(
      new Uint8Array(fs.readFileSync(source.ledger)),
      new Uint8Array(fs.readFileSync(source.attachments)),
    ),
  );
  return inspectCandidate(h.io, 'zip', picked(archive));
}

describe('rollback', () => {
  beforeEach(() => {
    seedLive();
  });

  it('puts BOTH databases back when the migration fails after the swap', async () => {
    const before = await liveBytes();
    const preview = await stagedZipPreview();
    h.failMigrateErp = true;

    await expect(applyRestore(h.io, preview)).rejects.toMatchObject({
      code: 'migrate-failed',
    });

    expect(fs.readFileSync(h.livePath('erp')).equals(before.erp)).toBe(true);
    expect(fs.readFileSync(h.livePath('attachments')).equals(before.attachments)).toBe(true);
    expect(h.marker.value).toBeNull();
    expect(sidecarFiles(h.dbDir)).toEqual([]);
    expect(stagedLeftovers(h.dbDir)).toEqual([]);
  });

  it('puts BOTH databases back when the copy fails halfway through', async () => {
    const before = await liveBytes();
    const preview = await stagedZipPreview();
    // The ledger is promoted first; the receipts copy is the one that dies.
    h.failCopyInto = h.livePath('attachments');

    await expect(applyRestore(h.io, preview)).rejects.toMatchObject({
      code: 'copy-failed',
    });

    expect(fs.readFileSync(h.livePath('erp')).equals(before.erp)).toBe(true);
    expect(fs.readFileSync(h.livePath('attachments')).equals(before.attachments)).toBe(true);
    expect(h.marker.value).toBeNull();
    expect(stagedLeftovers(h.dbDir)).toEqual([]);
  });

  it('writes the marker BEFORE the first destructive byte and clears it after', async () => {
    const preview = await stagedZipPreview();
    await applyRestore(h.io, preview);

    // Every moment a live file was overwritten, a marker was already on disk.
    expect(h.markerDuringSwap.length).toBeGreaterThan(0);
    for (const seen of h.markerDuringSwap) {
      expect(seen).not.toBeNull();
      const marker = JSON.parse(seen as string) as RestoreMarker;
      expect(marker.entries.map((e) => e.target).sort()).toEqual(['attachments', 'erp']);
      for (const entry of marker.entries) expect(fs.existsSync(entry.snapshotPath)).toBe(true);
    }
    expect(h.marker.value).toBeNull();
  });
});

describe('interrupted restore, next launch', () => {
  beforeEach(() => {
    seedLive();
  });

  /**
   * Simulate a process kill mid-swap: run a real restore to produce a real
   * marker and real snapshots, then put the marker back and corrupt the live
   * ledger — which is exactly the state the phone wakes up in.
   */
  async function simulateKill(): Promise<{
    marker: RestoreMarker;
    before: Buffer;
  }> {
    const before = (await liveBytes()).erp;
    const preview = await stagedZipPreview();
    await applyRestore(h.io, preview);
    const raw = h.markerDuringSwap[0] as string;
    h.marker.value = raw;
    fs.writeFileSync(h.livePath('erp'), Buffer.from('half-written garbage'));
    return { marker: JSON.parse(raw) as RestoreMarker, before };
  }

  it('is detected at boot and rolls BOTH databases back to their snapshots', async () => {
    const { before } = await simulateKill();

    const marker = detectInterruptedRestore(h.io);
    expect(marker).not.toBeNull();
    expect(isRollbackAvailable(h.io, marker as RestoreMarker)).toBe(true);

    await rollbackInterruptedRestore(h.io, marker as RestoreMarker);

    expect(fs.readFileSync(h.livePath('erp')).equals(before)).toBe(true);
    expect(h.marker.value).toBeNull();
    expect(sidecarFiles(h.dbDir)).toEqual([]);
    expect(stagedLeftovers(h.dbDir)).toEqual([]);
    expect(attachmentRows(h.livePath('attachments'))).toHaveLength(1); // the pre-restore seed
  });

  it('refuses a HALF rollback when one snapshot is gone', async () => {
    const { marker } = await simulateKill();
    fs.rmSync(marker.entries[1].snapshotPath);

    expect(isRollbackAvailable(h.io, marker)).toBe(false);
    await expect(rollbackInterruptedRestore(h.io, marker)).rejects.toMatchObject({
      code: 'file-missing',
    });
    // Refused means refused: the marker stays, so the next launch asks again.
    expect(h.marker.value).not.toBeNull();
  });

  it('ignores a marker that is not readable', () => {
    h.marker.value = 'not json';
    expect(detectInterruptedRestore(h.io)).toBeNull();
    h.marker.value = JSON.stringify({
      format: 'zip',
      entries: [],
      startedAt: 1,
    });
    expect(detectInterruptedRestore(h.io)).toBeNull();
  });
});
