import {
  ATTACHMENTS_DDL,
  CORE_DDL,
  DOCS_PARTY_INDEX_DDL,
  EXPENSES_DDL,
  TRANSACTIONS_DDL,
  TRANSACTIONS_INDEXES_DDL,
  VOICE_NOTES_DDL,
} from './ddl';
import { sentinelInsertSql } from './sentinels';

// GENERATOR for `prod-schema.sql` — the standalone artifact that provisions a
// clean PRODUCTION database (schema + the two required integrity rows only).
//
// It is DERIVED, never hand-written: every statement comes from the same DDL
// constants `runMigrations()` runs, so the .sql file cannot drift from the phone.
// `runMigrations()` stays the runtime authority; this only concatenates its parts
// in boot order. Re-running `runMigrations()` over a DB provisioned by this file
// is a no-op (every statement is IF NOT EXISTS / INSERT OR IGNORE).
//
// The ADD COLUMN back-fills from migrate.ts are deliberately ABSENT: they exist
// only to upgrade OLD installs to the current shape, and a fresh DB built from
// CORE_DDL already IS that shape.

const HEADER = `-- prod-schema.sql — GENERATED, DO NOT EDIT BY HAND.
--
-- Provisions a clean production erp.db: full schema + the two sentinel (null
-- object walk-in) parties. Contains NO items, documents, stock or demo data.
--
-- Regenerate:  GEN_PROD_SCHEMA=1 npx jest src/db/prod-schema.test.ts
-- Source:      src/db/prod-schema.ts  (derived from src/db/ddl.ts + sentinels.ts)`;

const ERP_DB_HEADER = `-- ========================================================================
-- erp.db  (the main application database)
-- ========================================================================`;

const ATTACHMENTS_HEADER = `-- ========================================================================
-- attachments.db  (SEPARATE FILE — receipt/proof BLOBs; apply to attachments.db,
-- NOT erp.db). At runtime this is created by initAttachmentsDb() on its own file.
-- ========================================================================`;

const trim = (s: string) => s.trim();

/** The erp.db section only — schema + sentinel rows. Used for validation. */
export function buildErpSchemaSql(): string {
  return [
    trim(CORE_DDL),
    trim(TRANSACTIONS_DDL),
    trim(EXPENSES_DDL),
    trim(VOICE_NOTES_DDL),
    trim(TRANSACTIONS_INDEXES_DDL),
    trim(DOCS_PARTY_INDEX_DDL),
    '-- Sentinel parties — REQUIRED integrity rows (documents.party_id is never null).',
    sentinelInsertSql(0),
  ].join('\n\n');
}

/** The full artifact: header + erp.db section + attachments.db section. */
export function buildProdSchemaSql(): string {
  return (
    [HEADER, ERP_DB_HEADER, buildErpSchemaSql(), ATTACHMENTS_HEADER, trim(ATTACHMENTS_DDL)].join(
      '\n\n',
    ) + '\n'
  );
}
