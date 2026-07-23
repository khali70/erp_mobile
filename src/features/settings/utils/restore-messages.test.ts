import type { RestoreFailureCode } from '../restore-validation';
import { restoreErrorKey } from './restore-messages';

const ALL_CODES: RestoreFailureCode[] = [
  'not-sqlite',
  'unknown-schema',
  'wrong-slot',
  'schema-too-new',
  'file-missing',
  'no-space',
  'copy-failed',
  'migrate-failed',
  'unknown',
];

describe('restoreErrorKey', () => {
  it('gives every failure its OWN message — a shared "failed" tells the owner nothing', () => {
    const keys = ALL_CODES.map((c) => restoreErrorKey(c));
    expect(new Set(keys).size).toBe(ALL_CODES.length);
  });

  it('names the slot the file actually belongs to on a mix-up', () => {
    expect(restoreErrorKey('wrong-slot', 'erp')).toBe('settings.restore.error.wrongSlotErp');
    expect(restoreErrorKey('wrong-slot', 'attachments')).toBe(
      'settings.restore.error.wrongSlotAttachments',
    );
  });

  it('points a newer-schema refusal at the update message', () => {
    expect(restoreErrorKey('schema-too-new')).toBe('settings.restore.error.schemaTooNew');
  });

  it('falls back to the generic key for an unknown code', () => {
    expect(restoreErrorKey('unknown')).toBe('settings.restore.error.unknown');
  });
});
