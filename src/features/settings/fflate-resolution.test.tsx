import { buildBackupZip, readBackupZip, ZIP_ENTRY_ERP } from './backup-format';

/**
 * `fflate` must resolve under BOTH jest projects, because it is loaded by app
 * code the RN suite renders — not only by the node suite that tests the archive
 * itself. It ships ESM and CJS side by side, and a package like that is exactly
 * the kind that resolves under one preset and explodes under the other.
 *
 * This file is a `.tsx` on purpose: that is what puts it in the `hooks`
 * (jest-expo) project. No transform or moduleNameMapper entry is needed today;
 * if that ever changes, it fails here rather than in a release build.
 */
it('resolves under the RN/jest-expo project and round-trips an archive', () => {
  const read = readBackupZip(buildBackupZip(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])));
  expect(typeof read).not.toBe('string');
  expect([...(read as { erp: Uint8Array }).erp]).toEqual([1, 2, 3]);
  expect(ZIP_ENTRY_ERP).toBe('erp.db');
});
