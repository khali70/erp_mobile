import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { ATTACHMENTS_DDL } from './ddl';

// Separate DB file for receipt attachment BLOBs. Kept out of erp.db so the hot
// ERP tables stay lean (fast VACUUM / small page cache) and so a backup can copy
// bytes independently. Only the attachment repository may import this handle.
export const attachmentsDb = openDatabaseSync('attachments.db');

// Bootstrap the attachments table. Called from runMigrations() at app boot,
// alongside the erp.db migration. Idempotent (IF NOT EXISTS). The DDL lives in
// ./ddl so the prod-schema generator emits the same table this creates.
export function initAttachmentsDb(): void {
  migrateAttachmentsDatabase(attachmentsDb);
}

/**
 * The same bootstrap against an ARBITRARY handle — used by RESTORE on the file
 * it has just copied over the live attachments path, through a fresh connection
 * (the singleton is closed for the swap). Idempotent, like its caller.
 */
export function migrateAttachmentsDatabase(handle: SQLiteDatabase): void {
  handle.execSync(ATTACHMENTS_DDL);
}
