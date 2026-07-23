import { ATTACHMENTS_DDL } from '@/db/ddl';

/**
 * THE BACKUP FILE FORMAT — pure, so the node suite runs these exact statements
 * against a real SQLite (better-sqlite3) instead of trusting them by eye. No
 * `expo-*` import may enter this module.
 *
 * WHY ONE FILE
 * ------------
 * The app keeps two databases: the ledger (`erp.db`) and the receipt bytes
 * (`attachments.db`). Backup used to snapshot both and push them through the OS
 * share sheet back to back — and that silently lost the second one. `shareAsync`
 * resolves when the CHOOSER is dismissed, not when the file has been saved, so
 * the second sheet was requested while the first was still settling and Android
 * dropped it. Owners ended up with `erp-backup-*.db` and nothing else: every
 * receipt photo they thought they had backed up was never on their disk at all.
 *
 * The fix is one file, so there is one share and nothing to drop. It is built
 * with SQLite's own `ATTACH` + `INSERT … SELECT`, which streams rows INSIDE
 * SQLite — the blobs never pass through JS memory, and no archiving dependency
 * is added to the project.
 *
 * WHY A META TABLE, NOT A TABLE SNIFF
 * -----------------------------------
 * A merged file is a ledger that also happens to carry an `attachments` table,
 * and "has an attachments table" is a guess, not a fact: it cannot tell a merged
 * backup from a future schema that legitimately grows one. So the format is
 * DECLARED, in a one-row-per-key `backup_meta` table, and read back by VALUE
 * (`format = 'erp-merged-backup'`) — never by the table's mere presence. It also
 * carries a format version of its own, so a file written by a newer build is
 * refused instead of half-understood.
 *
 * `backup_meta` and the merged-in `attachments` table are BACKUP ARTIFACTS. They
 * are dropped from the ledger on the way back in (see `DROP_MERGED_ARTIFACTS_SQL`)
 * so a restored `erp.db` is byte-for-byte the shape a normal one has.
 */

/** A live database file. */
export type RestoreTarget = 'erp' | 'attachments';

/**
 * What a picked backup file IS.
 * - `merged`      — the current format: ledger + attachments payload + marker.
 * - `erp`         — a legacy bare `erp-backup-*.db` (ledger only).
 * - `attachments` — a legacy bare `erp-attachments-*.db`.
 *
 * The two legacy formats are still accepted, and always will be: owners have
 * them on disk from builds that shipped before the merge, and a backup format
 * that stops reading its own past is not a backup format.
 */
export type BackupFormat = 'merged' | RestoreTarget;

export const BACKUP_META_TABLE = 'backup_meta';
/** The marker VALUE. Presence of the table proves nothing; this string does. */
export const MERGED_BACKUP_FORMAT = 'erp-merged-backup';
/** Bump when the merged layout changes in a way an older build misreads. */
export const MERGED_BACKUP_FORMAT_VERSION = 1;

export const BACKUP_META_DDL = `
CREATE TABLE IF NOT EXISTS ${BACKUP_META_TABLE} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Single-quote a SQL string literal (doubling any quote inside it). */
export function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export type BackupMetaInput = {
  createdAt: number;
  appSchemaVersion: number;
  attachmentCount: number;
};

/** The rows a merged backup declares about itself. */
export function backupMetaRows(input: BackupMetaInput): [string, string][] {
  return [
    ['format', MERGED_BACKUP_FORMAT],
    ['format_version', String(MERGED_BACKUP_FORMAT_VERSION)],
    ['app_schema_version', String(input.appSchemaVersion)],
    ['created_at', String(input.createdAt)],
    ['attachment_count', String(input.attachmentCount)],
  ];
}

/** DDL + upsert of the marker rows. `OR REPLACE` so a re-merge is idempotent. */
export function writeBackupMetaSql(input: BackupMetaInput): string {
  const values = backupMetaRows(input)
    .map(([key, value]) => `(${sqlQuote(key)}, ${sqlQuote(value)})`)
    .join(', ');
  return `${BACKUP_META_DDL}\nINSERT OR REPLACE INTO ${BACKUP_META_TABLE} (key, value) VALUES ${values};`;
}

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

/** The inverse of `backupMetaRows` — tolerant of missing/extra/garbage rows. */
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

/**
 * Fold the attachments database into a LEDGER SNAPSHOT (run on a connection to
 * the snapshot). `INSERT … SELECT` across an ATTACHed database is why this
 * approach was chosen over zipping: SQLite streams the blobs itself and JS never
 * holds a receipt photo in memory.
 *
 * The `DROP TABLE IF EXISTS` is not defensive against the ledger's own schema —
 * `erp.db` has no `attachments` TABLE (`documents.attachments` and
 * `expenses.attachments` are TEXT columns holding JSON, and a test asserts the
 * distinction). It only clears a leftover from an earlier merge of the same file.
 */
export function mergeAttachmentsSql(attachmentsDbPath: string): string {
  return [
    `ATTACH DATABASE ${sqlQuote(attachmentsDbPath)} AS att;`,
    'DROP TABLE IF EXISTS main.attachments;',
    ATTACHMENTS_DDL,
    'INSERT INTO main.attachments SELECT * FROM att.attachments;',
    'DETACH DATABASE att;',
  ].join('\n');
}

/**
 * Split the payload back out (run on a connection to the LIVE attachments db,
 * with the freshly restored ledger attached). The `DELETE` makes a re-run
 * idempotent; on the intended path the target file was just created empty.
 */
export function extractAttachmentsSql(ledgerDbPath: string): string {
  return [
    `ATTACH DATABASE ${sqlQuote(ledgerDbPath)} AS src;`,
    'DELETE FROM main.attachments;',
    'INSERT INTO main.attachments SELECT * FROM src.attachments;',
    'DETACH DATABASE src;',
  ].join('\n');
}

/** Remove the backup-only artifacts from a restored ledger. */
export const DROP_MERGED_ARTIFACTS_SQL = `
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS ${BACKUP_META_TABLE};
`;

/**
 * Which LIVE databases a restore of `format` replaces — and therefore which ones
 * must be safety-snapshotted first and rolled back together if it fails. A
 * merged file touches BOTH; a rollback that covered only the ledger would leave
 * the owner's receipts belonging to a database that no longer exists.
 */
export function restoreTargetsFor(format: BackupFormat): RestoreTarget[] {
  return format === 'merged' ? ['erp', 'attachments'] : [format];
}

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
 * What the picked file is, from its table list and its self-declaration.
 *
 * The marker is checked FIRST and BY VALUE. Only then do the legacy shapes get a
 * look, and those two are disjoint — `erp.db` has no `attachments` table and
 * `attachments.db` has nothing else — which is what lets a wrong-slot message
 * name the slot the file actually belongs to.
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

/** True when the file declares a merged layout this build does not understand. */
export function isBackupFormatTooNew(meta: BackupMeta | null): boolean {
  return (
    meta?.format === MERGED_BACKUP_FORMAT &&
    meta.formatVersion !== null &&
    meta.formatVersion > MERGED_BACKUP_FORMAT_VERSION
  );
}
