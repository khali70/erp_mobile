import { openDatabaseSync } from 'expo-sqlite';

// Separate DB file for receipt attachment BLOBs. Kept out of erp.db so the hot
// ERP tables stay lean (fast VACUUM / small page cache) and so a backup can copy
// bytes independently. Only the attachment repository may import this handle.
export const attachmentsDb = openDatabaseSync('attachments.db');

// Bootstrap the attachments table. Called from runMigrations() at app boot,
// alongside the erp.db migration. Idempotent (IF NOT EXISTS).
export function initAttachmentsDb(): void {
  attachmentsDb.execSync(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      bytes BLOB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_att_doc ON attachments(document_id);
  `);
}
