import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import type { RestoreFailureCode } from '../restore-validation';
import { restoreContentsKey, restoreErrorKey, restoreFormatKey } from './restore-messages';

const ALL_CODES: RestoreFailureCode[] = [
  'not-sqlite',
  'not-zip',
  'zip-missing-ledger',
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

  it('names the format the file actually is on a mix-up', () => {
    expect(restoreErrorKey('wrong-slot', 'merged')).toBe('settings.restore.error.wrongSlotMerged');
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

  it('separates “not an archive” from “archive with no books in it”', () => {
    // Two different next actions for the owner: reach for an older .db backup,
    // or reach for a different archive entirely.
    expect(restoreErrorKey('not-zip')).toBe('settings.restore.error.notZip');
    expect(restoreErrorKey('zip-missing-ledger')).toBe('settings.restore.error.zipMissingLedger');
  });
});

/** Walk a dotted key into a locale bundle. */
function lookup(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, bundle);
}

describe('every key these mappers return actually exists, in BOTH languages', () => {
  const keys = [
    ...ALL_CODES.map((c) => restoreErrorKey(c)),
    ...(['merged', 'erp', 'attachments'] as const).map((f) => restoreErrorKey('wrong-slot', f)),
    ...(['zip', 'merged', 'erp', 'attachments'] as const).map(restoreContentsKey),
    ...(['zip', 'merged', 'erp', 'attachments'] as const).map(restoreFormatKey),
    'settings.backup.errorTooLarge',
  ];

  it.each(keys)('%s', (key) => {
    expect(typeof lookup(ar, key)).toBe('string');
    expect(typeof lookup(en, key)).toBe('string');
  });
});

describe('restoreContentsKey', () => {
  it('describes ledger-only and receipts-only differently from a full backup', () => {
    const keys = (['merged', 'erp', 'attachments'] as const).map(restoreContentsKey);
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toBe('settings.restore.preview.countsMerged');
    // A zip and a merged file hold the same thing, so they promise the same thing.
    expect(restoreContentsKey('zip')).toBe(restoreContentsKey('merged'));
  });
});

describe('restoreFormatKey', () => {
  it('names all FOUR accepted shapes distinctly', () => {
    const keys = (['zip', 'merged', 'erp', 'attachments'] as const).map(restoreFormatKey);
    expect(new Set(keys).size).toBe(4);
  });
});
