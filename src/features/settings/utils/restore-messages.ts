import type { RestoreFailureCode, RestoreTarget } from '../restore-validation';

/**
 * Failure code → i18n key. Pure and exhaustive: every code gets its OWN
 * sentence, because "restore failed" tells the owner nothing about whether to
 * pick a different file, free up space, or update the app.
 *
 * `wrong-slot` splits on which slot the file ACTUALLY belongs to, so the message
 * can name it — the two backup files are emitted seconds apart with near
 * identical names and mixing them up is the likeliest mistake in this flow.
 */
export function restoreErrorKey(code: RestoreFailureCode, actualTarget?: RestoreTarget): string {
  switch (code) {
    case 'not-sqlite':
      return 'settings.restore.error.notSqlite';
    case 'unknown-schema':
      return 'settings.restore.error.unknownSchema';
    case 'wrong-slot':
      return actualTarget === 'erp'
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
