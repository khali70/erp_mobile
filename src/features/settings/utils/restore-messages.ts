import type { BackupFormat } from '../backup-format';
import type { RestoreFailureCode } from '../restore-validation';

/**
 * Failure code → i18n key. Pure and exhaustive: every code gets its OWN
 * sentence, because "restore failed" tells the owner nothing about whether to
 * pick a different file, free up space, or update the app.
 *
 * `wrong-slot` splits on the format the file ACTUALLY is, so the message can
 * name it. That is the likeliest mistake in this flow: an owner who has used the
 * app for a while has `erp-backup-*.db`, `erp-attachments-*.db` and a merged
 * `rafuf-backup-*.db` sitting beside the current `.zip`, all named alike.
 *
 * `not-zip` and `zip-missing-ledger` are deliberately separate: "this is not a
 * backup archive" points the owner at their older `.db` files, while "this
 * archive has no ledger in it" points them at a different archive entirely.
 */
export function restoreErrorKey(code: RestoreFailureCode, actualFormat?: BackupFormat): string {
  switch (code) {
    case 'not-sqlite':
      return 'settings.restore.error.notSqlite';
    case 'not-zip':
      return 'settings.restore.error.notZip';
    case 'zip-missing-ledger':
      return 'settings.restore.error.zipMissingLedger';
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
 * What the picked file actually contains, for the confirm sheet — a full backup,
 * a ledger-only file, or a receipts-only file are three different promises about
 * what the owner is about to get back.
 */
export function restoreContentsKey(format: BackupFormat): string {
  switch (format) {
    case 'zip':
    case 'merged':
      return 'settings.restore.preview.countsMerged';
    case 'erp':
      return 'settings.restore.preview.countsLedger';
    default:
      return 'settings.restore.preview.countsAttachments';
  }
}

/**
 * The file's own name for itself, shown on the confirm sheet. An owner with four
 * lookalike backups in their Downloads folder needs to be told which KIND of
 * thing they just picked before they type the confirmation word.
 */
export function restoreFormatKey(format: BackupFormat): string {
  switch (format) {
    case 'zip':
      return 'settings.restore.preview.formatZip';
    case 'merged':
      return 'settings.restore.preview.formatMerged';
    case 'erp':
      return 'settings.restore.preview.formatLedger';
    default:
      return 'settings.restore.preview.formatAttachments';
  }
}
