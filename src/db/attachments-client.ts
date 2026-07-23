import { openDatabaseSync } from 'expo-sqlite';
import { ATTACHMENTS_DDL } from './ddl';

// Separate DB file for receipt attachment BLOBs. Kept out of erp.db so the hot
// ERP tables stay lean (fast VACUUM / small page cache) and so a backup can copy
// bytes independently. Only the attachment repository may import this handle.
export const attachmentsDb = openDatabaseSync('attachments.db');

// Bootstrap the attachments table. Called from runMigrations() at app boot,
// alongside the erp.db migration. Idempotent (IF NOT EXISTS). The DDL lives in
// ./ddl so the prod-schema generator emits the same table this creates.
export function initAttachmentsDb(): void {
  attachmentsDb.execSync(ATTACHMENTS_DDL);
}
