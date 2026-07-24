import { unzipSync, zipSync } from 'fflate';

/**
 * THE BACKUP FILE FORMATS — pure, so the node suite runs these exact decisions
 * and this exact SQL against real SQLite and real fflate rather than trusting
 * them by eye. No `expo-*` import may enter this module.
 *
 * WHAT BACKUP WRITES TODAY: a ZIP.
 * --------------------------------
 * `rafuf-backup-<stamp>.zip`, holding the two databases side by side as raw
 * snapshots — `erp.db` (the ledger) and `attachments.db` (the receipt bytes).
 * The owner can open it on any PC and see exactly what they have, which is the
 * point: a backup nobody can inspect is a backup nobody trusts.
 *
 * WHY ONE ARTIFACT AT ALL — the history worth keeping
 * ---------------------------------------------------
 * Backup once shared the two databases as two files, back to back, and quietly
 * lost the second. `Sharing.shareAsync` resolves when the CHOOSER is dismissed,
 * not when the file has finished being saved, so the second sheet was requested
 * while the first was still settling and Android swallowed it. Owners received
 * the ledger and nothing else: every receipt photo they believed was backed up
 * had never reached their storage, and the attachments half of restore had no
 * file to point at. One artifact, one share, nothing to drop — that rule
 * outlives any change to what the artifact IS.
 *
 * THE FOUR FORMATS RESTORE MUST READ
 * ----------------------------------
 *  `zip`         — the current one, above.
 *  `merged`      — a single `.db` carrying the ledger, an `attachments` table
 *                  and a `backup_meta` marker. A shipped build wrote these, so
 *                  they are on owners' devices and restore still splits them.
 *                  Nothing WRITES this format any more.
 *  `erp`         — a bare ledger `.db` (`erp-backup-*.db`).
 *  `attachments` — a bare `erp-attachments-*.db`.
 *
 * A backup format that stops reading its own past is not a backup format.
 *
 * WHY THE MERGED MARKER IS A VALUE, NOT A TABLE SNIFF
 * --------------------------------------------------
 * A merged file is a ledger that also happens to carry an `attachments` table,
 * and "has an attachments table" is a guess: it cannot tell a merged backup from
 * a future schema that legitimately grows one. So that format DECLARED itself in
 * a one-row-per-key `backup_meta` table, read back BY VALUE
 * (`format = 'erp-merged-backup'`), with a format version of its own so a file
 * from a newer build is refused rather than half-understood.
 */

/** A live database file. */
export type RestoreTarget = 'erp' | 'attachments';

/** What a picked backup file IS. */
export type BackupFormat = 'zip' | 'merged' | RestoreTarget;

// ---------------------------------------------------------------------------
// ZIP — the current format
// ---------------------------------------------------------------------------

/** The entry names inside the archive. Raw databases, no directory prefix. */
export const ZIP_ENTRY_ERP = 'erp.db';
export const ZIP_ENTRY_ATTACHMENTS = 'attachments.db';

/**
 * DEFLATE level 1 — fast, not thorough, and that is the right trade here.
 *
 * The archive holds two files whose bytes fall into very different classes. The
 * ledger's pages are text, small integers and index structures: highly
 * redundant, and level 1 already recovers most of what level 9 would. The
 * attachments database is almost entirely JPEG/PNG blobs, which are ALREADY
 * compressed — no deflate level gets anything meaningful out of them, and the
 * high ones just burn CPU on a low-end phone while `zipSync` blocks the JS
 * thread and the UI sits frozen.
 *
 * Level 0 (store) was the other candidate and is rejected: it throws away the
 * real compression available on the ledger for no gain on the half that matters.
 */
export const ZIP_COMPRESSION_LEVEL = 1;

/**
 * The ceiling, measured on the two SNAPSHOTS before anything is zipped.
 *
 * `zipSync` needs both databases fully in JS memory as `Uint8Array` PLUS an
 * output buffer, so peak transient memory is roughly double this number — about
 * 512 MB at the limit, past what a low-end Android device will hand one app.
 * Refusing early with a message the owner can act on beats being killed by the
 * OS halfway through with nothing to show for it.
 *
 * 256 MB is far above any realistic shop: the ledger is kilobytes to a few
 * megabytes, so this is really a ceiling on receipt photos.
 */
export const MAX_BACKUP_BYTES = 256 * 1024 * 1024;

/** True when the combined snapshots are too big for this device to zip. */
export function exceedsBackupSizeLimit(totalBytes: number, limit = MAX_BACKUP_BYTES): boolean {
  return totalBytes > limit;
}

/**
 * Every ZIP opens with a PK signature — `PK\x03\x04` for an archive with
 * entries, `PK\x05\x06` for an empty one. An empty archive is not a valid
 * backup, but it IS a zip, and must be rejected as "missing the ledger" rather
 * than "not a zip": those two send the owner to different next actions.
 */
export function isZipHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const third = bytes[2];
  const fourth = bytes[3];
  return (third === 0x03 && fourth === 0x04) || (third === 0x05 && fourth === 0x06);
}

/**
 * fflate's zip walker treats every entry value that is NOT an `ArrayBuffer` view
 * as a SUBDIRECTORY and recurses into its enumerable keys. Hand it a thenable —
 * e.g. the result of `File.bytesSync()` when that native call resolves to a
 * Promise instead of bytes on a device without JSI — and it silently writes
 * `erp.db/then/`, `erp.db/catch/`, `erp.db/_x/` … : a valid zip full of empty
 * folders, no ledger, no error. A backup that fails LOUDLY here beats one that
 * hands the owner a plausible-looking archive with none of their data in it.
 */
function assertBytes(value: Uint8Array, entry: string): void {
  if (!ArrayBuffer.isView(value)) {
    throw new TypeError(
      `Backup entry "${entry}" is not raw bytes (got ${
        value === null ? 'null' : typeof value
      }); refusing to write an empty archive.`,
    );
  }
}

/** Build the archive. `attachments` may be an EMPTY database, never omitted. */
export function buildBackupZip(erp: Uint8Array, attachments: Uint8Array): Uint8Array {
  assertBytes(erp, ZIP_ENTRY_ERP);
  assertBytes(attachments, ZIP_ENTRY_ATTACHMENTS);
  return zipSync(
    { [ZIP_ENTRY_ERP]: erp, [ZIP_ENTRY_ATTACHMENTS]: attachments },
    { level: ZIP_COMPRESSION_LEVEL },
  );
}

export type ZipReadFailure = 'not-zip' | 'zip-missing-ledger';

export type ZipContents = {
  erp: Uint8Array;
  /** Absent when the archive carries no attachments entry — tolerated. */
  attachments: Uint8Array | null;
};

/**
 * Read the archive back, or say precisely what is wrong with it. Returns a
 * failure code rather than throwing, because "that is not an archive" and "that
 * archive has no books in it" are two different sentences for the owner.
 */
export function readBackupZip(bytes: Uint8Array): ZipContents | ZipReadFailure {
  if (!isZipHeader(bytes)) return 'not-zip';
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    // A PK header on a truncated or corrupt archive.
    return 'not-zip';
  }
  const erp = entries[ZIP_ENTRY_ERP];
  if (!erp || erp.length === 0) return 'zip-missing-ledger';
  const attachments = entries[ZIP_ENTRY_ATTACHMENTS];
  return {
    erp,
    attachments: attachments && attachments.length > 0 ? attachments : null,
  };
}

// ---------------------------------------------------------------------------
// MERGED `.db` — read-only legacy, still on owners' devices
// ---------------------------------------------------------------------------

export const BACKUP_META_TABLE = 'backup_meta';
/** The marker VALUE. Presence of the table proves nothing; this string does. */
export const MERGED_BACKUP_FORMAT = 'erp-merged-backup';
/** The highest merged layout this build knows how to take apart. */
export const MERGED_BACKUP_FORMAT_VERSION = 1;

export type BackupMeta = {
  format: string | null;
  formatVersion: number | null;
  appSchemaVersion: number | null;
  createdAt: number | null;
  attachmentCount: number | null;
};

const num = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Read a merged file's self-declaration. Tolerant of missing/garbage rows. */
export function parseBackupMeta(rows: readonly { key: string; value: string }[]): BackupMeta {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    format: map.get('format') ?? null,
    formatVersion: num(map.get('format_version')),
    appSchemaVersion: num(map.get('app_schema_version')),
    createdAt: num(map.get('created_at')),
    attachmentCount: num(map.get('attachment_count')),
  };
}

/** True when the file declares a merged layout this build cannot take apart. */
export function isBackupFormatTooNew(meta: BackupMeta | null): boolean {
  return (
    meta?.format === MERGED_BACKUP_FORMAT &&
    meta.formatVersion !== null &&
    meta.formatVersion > MERGED_BACKUP_FORMAT_VERSION
  );
}

/** Single-quote a SQL string literal (doubling any quote inside it). */
export function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * SPLIT a merged file's payload back out — run on a connection to the LIVE
 * attachments database, with the freshly restored ledger ATTACHed.
 *
 * `INSERT … SELECT` across an ATTACH streams the blobs INSIDE SQLite; JS never
 * holds a receipt photo. The `DELETE` makes a re-run idempotent; on the intended
 * path the target file was just created empty.
 */
export function extractAttachmentsSql(ledgerDbPath: string): string {
  return [
    `ATTACH DATABASE ${sqlQuote(ledgerDbPath)} AS src;`,
    'DELETE FROM main.attachments;',
    'INSERT INTO main.attachments SELECT * FROM src.attachments;',
    'DETACH DATABASE src;',
  ].join('\n');
}

/**
 * Remove the backup-only artifacts from a restored ledger, so `erp.db` ends up
 * in exactly the shape a never-restored one has. Without this the next backup
 * would snapshot a ledger that still carries a stale copy of the receipts.
 */
export const DROP_MERGED_ARTIFACTS_SQL = `
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS ${BACKUP_META_TABLE};
`;

// ---------------------------------------------------------------------------
// DETECTION
// ---------------------------------------------------------------------------

/**
 * Tables that MUST exist for a file to hold this app's ledger. Deliberately the
 * core set only (not indexes, not the additive columns): an OLD backup is a
 * legitimate restore source and will be missing later columns, which the
 * migration pass adds back. Requiring a column here would reject exactly the
 * backups this feature exists to recover.
 */
export const ERP_REQUIRED_TABLES = [
  'items',
  'documents',
  'document_lines',
  'stock_levels',
  'customers',
  'suppliers',
] as const;

/** The attachments payload is a single BLOB table — that is its whole schema. */
export const ATTACHMENTS_REQUIRED_TABLES = ['attachments'] as const;

function hasAll(tables: readonly string[], required: readonly string[]): boolean {
  const present = new Set(tables);
  return required.every((table) => present.has(table));
}

/**
 * What a picked DATABASE is (a zip is identified by its own header, before it
 * ever reaches SQLite).
 *
 * The merged marker is checked FIRST and BY VALUE. Only then do the bare shapes
 * get a look, and those two are disjoint — a ledger has no `attachments` table
 * and an attachments database has nothing else — which is what lets a wrong-slot
 * message name the format the file actually is.
 *
 * Returns `null` for a real SQLite database that is simply not ours.
 */
export function detectBackupFormat(
  tables: readonly string[],
  meta: BackupMeta | null,
): BackupFormat | null {
  const hasErp = hasAll(tables, ERP_REQUIRED_TABLES);
  const hasAttachments = hasAll(tables, ATTACHMENTS_REQUIRED_TABLES);
  if (meta?.format === MERGED_BACKUP_FORMAT && hasErp && hasAttachments) return 'merged';
  if (hasErp) return 'erp';
  if (hasAttachments) return 'attachments';
  return null;
}

/**
 * Which LIVE databases a restore of `format` replaces — and therefore which must
 * be safety-snapshotted first and rolled back TOGETHER if it fails. A zip or a
 * merged file touches BOTH; a rollback that put the ledger back but not the
 * receipts would leave the two halves describing different moments in the shop's
 * history.
 *
 * `hasAttachments` is false only for a zip whose archive carried no attachments
 * entry; for the bare single-database formats it is irrelevant.
 */
export function restoreTargetsFor(format: BackupFormat, hasAttachments = true): RestoreTarget[] {
  if (format === 'zip' || format === 'merged') {
    return hasAttachments ? ['erp', 'attachments'] : ['erp'];
  }
  return [format];
}
