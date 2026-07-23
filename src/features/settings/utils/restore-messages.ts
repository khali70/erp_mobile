import type { BackupFormat } from '../backup-format';
import type { RestoreFailureCode } from '../restore-validation';

/**
 * Failure code → i18n key. Pure and exhaustive: every code gets its OWN
 * sentence, because "restore failed" tells the owner nothing about whether to
 * pick a different file, free up space, or update the app.
 *
 * `wrong-slot` splits on the format the file ACTUALLY is, so the message can
 * name it. That is the likeliest mistake in this flow: an owner who has used the
 * app since before the single-file backup has legacy `erp-backup-*` and
 * `erp-attachments-*` files sitting beside the new merged one, all named alike.
 */
export function restoreErrorKey(code: RestoreFailureCode, actualFormat?: BackupFormat): string {
  switch (code) {
    case 'not-sqlite':
      return 'settings.restore.error.notSqlite';
    case 'unknown-schema':
      return 'settings.restore.error.unknownSchema';
    case 'wrong-slot':
      if (actualFormat === 'merged') return 'settings.restore.error.wrongSlotMerged';
      return actualFormat === 'erp'
        ? 'settings.restore.error.wrongSlotErp'
        : 'settings.restore.error.wrongSlotAttachments';
    case 'schema-too-new':
      return 'settings.restore.error.schemaTooNew';
    case 'file-missing':
      return 'settings.restore.error.fileMissing';
    case 'no-space':
      return 'settings.restore.error.noSpace';
    case 'copy-failed':
      return 'settings.restore.error.copyFailed';
    case 'migrate-failed':
      return 'settings.restore.error.migrateFailed';
    default:
      return 'settings.restore.error.unknown';
  }
}

/**
 * What the picked file actually contains, for the confirm sheet — a merged
 * backup, a legacy ledger, or a legacy receipts file are three different
 * promises about what the owner is about to get back.
 */
export function restoreContentsKey(format: BackupFormat): string {
  switch (format) {
    case 'merged':
      return 'settings.restore.preview.countsMerged';
    case 'erp':
      return 'settings.restore.preview.countsLedger';
    default:
      return 'settings.restore.preview.countsAttachments';
  }
}
