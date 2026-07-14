// "الكمية المطلوبة تتجاوز الرصيد المتاح." — which item? He has fourteen lines.
import { negativeStockMessage } from './stock-messages';

const NAMES: Record<string, string> = { A: 'زيت', B: 'سكر' };
const nameOf = (id: string) => NAMES[id] ?? id;
// Stands in for i18next: interpolates {{x}} exactly as the real resources do.
const t = (key: string, opts?: Record<string, unknown>) =>
  key === 'documents.errors.negativeStock'
    ? 'HEADLINE'
    : `${opts?.name}: asked ${opts?.requested}, available ${opts?.available}`;

describe('negativeStockMessage', () => {
  it('names EVERY offending item, with requested vs available', () => {
    const msg = negativeStockMessage(
      [
        { itemId: 'A', available: 3, requested: 8 },
        { itemId: 'B', available: 0, requested: 2 },
      ],
      nameOf,
      t,
      'en',
    );
    expect(msg.split('\n')).toEqual([
      'HEADLINE',
      'زيت: asked 8, available 3',
      'سكر: asked 2, available 0',
    ]);
  });

  it('localizes the numerals — an Arabic message does not print Latin digits', () => {
    const msg = negativeStockMessage([{ itemId: 'A', available: 3, requested: 8 }], nameOf, t, 'ar');
    expect(msg).toContain('٨');
    expect(msg).toContain('٣');
    expect(msg).not.toMatch(/[0-9]/);
  });

  it('falls back to the id rather than printing a blank name', () => {
    const msg = negativeStockMessage([{ itemId: 'ghost', available: 0, requested: 1 }], nameOf, t, 'en');
    expect(msg).toContain('ghost');
  });
});
