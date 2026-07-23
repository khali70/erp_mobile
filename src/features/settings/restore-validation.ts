import { APP_SCHEMA_VERSION } from '@/db/schema-version';

/**
 * RESTORE — the PURE half. Everything here is decidable from bytes and strings:
 * is this a SQLite file, whose schema is it, is it too new, which sidecars must
 * die. No `expo-*` import may ever enter this module — that is what lets the
 * node/ts-jest suite run these decisions for real (`restore-validation.test.ts`)
 * instead of mocking the one thing that must never be wrong: the check that runs
 * *before* the owner's live database is overwritten.
 *
 * The impure half (picker, file copies, handles, the swap) lives in `restore.ts`.
 */

/** Which of the two database files a candidate is meant to replace. */
export type RestoreTarget = 'erp' | 'attachments';

/**
 * Every SQLite database file begins with this exact 16-byte string, NUL
 * included (https://www.sqlite.org/fileformat.html#the_database_header).
 * Checking it is not paranoia: an owner picking from a file manager will hand
 * us a JPEG, a ZIP, or a Drive placeholder at least once, and `openDatabase` on
 * a non-database can fail late and confusingly — after we have started.
 */
export const SQLITE_MAGIC = 'SQLite format 3\u0000';
export const SQLITE_MAGIC_LENGTH = SQLITE_MAGIC.length;

/** True when `bytes` opens with the SQLite file-format magic. */
export function isSqliteHeader(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_MAGIC_LENGTH) return false;
  for (let i = 0; i < SQLITE_MAGIC_LENGTH; i += 1) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Tables that MUST exist for a file to be this app's ledger. Deliberately the
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

/** The attachments DB is a single BLOB table — that is its whole schema. */
export const ATTACHMENTS_REQUIRED_TABLES = ['attachments'] as const;

function hasAll(tables: readonly string[], required: readonly string[]): boolean {
  const present = new Set(tables);
  return required.every((table) => present.has(table));
}

/**
 * Which slot the picked file actually belongs to, from its table list — `null`
 * when it is a valid SQLite database but not one of ours (someone's WhatsApp
 * msgstore.db, a browser cache).
 *
 * The two schemas are disjoint: `erp.db` has no `attachments` TABLE (documents
 * carry an `attachments` JSON *column*), and `attachments.db` has nothing else.
 * That disjointness is what lets us name the correct slot in the error message
 * when the owner mixes up the two files — which they will, since the backup
 * flow emits both, seconds apart, with near-identical names.
 */
export function detectTarget(tables: readonly string[]): RestoreTarget | null {
  if (hasAll(tables, ERP_REQUIRED_TABLES)) return 'erp';
  if (hasAll(tables, ATTACHMENTS_REQUIRED_TABLES)) return 'attachments';
  return null;
}

export type RestoreRejectionCode =
  /** Not a SQLite file at all — wrong pick entirely. */
  | 'not-sqlite'
  /** A real SQLite file, but not this app's. */
  | 'unknown-schema'
  /** One of ours, in the wrong slot (ledger file picked as attachments, etc). */
  | 'wrong-slot'
  /** Written by a newer app build; restoring it would be a downgrade. */
  | 'schema-too-new';

export type RestoreRejection = {
  code: RestoreRejectionCode;
  /** For `wrong-slot`: the slot the file DOES belong to. */
  actualTarget?: RestoreTarget;
  /** For `schema-too-new`: the file's version and this build's. */
  fileVersion?: number;
  appVersion?: number;
};

/**
 * Every way a restore can fail. The rejection codes above are the PRE-FLIGHT
 * half — raised before a single byte of the live database is touched; the rest
 * happen during the swap and are followed by a rollback. The UI must be able to
 * tell the two apart, because "nothing of yours was touched" and "your previous
 * data was put back" are different promises. See `isPreFlightFailure`.
 */
export type RestoreFailureCode =
  | RestoreRejectionCode
  | 'file-missing'
  | 'no-space'
  | 'copy-failed'
  | 'migrate-failed'
  | 'unknown';

const PRE_FLIGHT: readonly RestoreFailureCode[] = [
  'not-sqlite',
  'unknown-schema',
  'wrong-slot',
  'schema-too-new',
  'file-missing',
  'no-space',
];

/** True when the failure happened before the live database was touched at all. */
export function isPreFlightFailure(code: RestoreFailureCode): boolean {
  return PRE_FLIGHT.includes(code);
}

export type CandidateFacts = {
  target: RestoreTarget;
  /** The first bytes of the file — `SQLITE_MAGIC_LENGTH` is enough. */
  header: Uint8Array;
  /** `name` column of every `table` row in the candidate's `sqlite_master`. */
  tables: readonly string[];
  /** The candidate's `PRAGMA user_version`. */
  userVersion: number;
  appVersion?: number;
};

/**
 * The gate. Returns `null` when the candidate may be restored into `target`,
 * or the reason it may not. Ordered cheapest-and-most-fundamental first, so the
 * message the owner sees names the real problem rather than a symptom of it.
 */
export function validateCandidate(facts: CandidateFacts): RestoreRejection | null {
  const appVersion = facts.appVersion ?? APP_SCHEMA_VERSION;

  if (!isSqliteHeader(facts.header)) return { code: 'not-sqlite' };

  const actualTarget = detectTarget(facts.tables);
  if (actualTarget === null) return { code: 'unknown-schema' };
  if (actualTarget !== facts.target) return { code: 'wrong-slot', actualTarget };

  if (facts.userVersion > appVersion) {
    return { code: 'schema-too-new', fileVersion: facts.userVersion, appVersion };
  }
  return null;
}

/** True when the candidate is older than this build and needs migrating forward. */
export function needsForwardMigration(userVersion: number, appVersion = APP_SCHEMA_VERSION): boolean {
  return userVersion < appVersion;
}

/**
 * WAL sidecars. `erp.db` runs in WAL mode (`enableChangeListener`), so the live
 * file is always flanked by `erp.db-wal` and `erp.db-shm`.
 *
 * These MUST be deleted as part of the swap. A WAL is a log of pages *for a
 * specific database file*, matched by a header counter in the -shm; leaving the
 * OLD database's WAL beside a NEW main file means SQLite replays pages that
 * belong to different content, and the corruption is silent — reads come back
 * plausible and wrong. `-journal` is here too for a rollback-mode file (an old
 * backup, or a DB restored onto a build that had not turned WAL on yet).
 */
export const SIDECAR_SUFFIXES = ['-wal', '-shm', '-journal'] as const;

/** The sidecar paths that sit beside `dbPath`. */
export function walSidecarPaths(dbPath: string): string[] {
  return SIDECAR_SUFFIXES.map((suffix) => `${dbPath}${suffix}`);
}
