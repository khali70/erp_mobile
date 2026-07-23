/**
 * The folding that decides whether contact autofill finds "أحمد" when the owner
 * types "احمد". Every case here is a spelling a real Egyptian address book
 * actually contains.
 */
import { foldText, foldTokens } from './text-fold';

describe('foldText — Arabic spellings that must collapse onto one key', () => {
  it('folds every alef variant onto ا', () => {
    const key = foldText('احمد');
    expect(foldText('أحمد')).toBe(key);
    expect(foldText('إحمد')).toBe(key);
    expect(foldText('آحمد')).toBe(key);
    expect(foldText('ٱحمد')).toBe(key);
  });

  it('folds taa marbuta onto haa — فاطمة and فاطمه are one name', () => {
    expect(foldText('فاطمة')).toBe(foldText('فاطمه'));
  });

  it('folds alef maqsura onto yaa — مصطفى and مصطفي are one name', () => {
    expect(foldText('مصطفى')).toBe(foldText('مصطفي'));
  });

  it('folds the hamza seats: ؤ→و, ئ→ي, and drops a bare ء', () => {
    expect(foldText('مؤمن')).toBe(foldText('مومن'));
    expect(foldText('رئيس')).toBe(foldText('رييس'));
    expect(foldText('سماء')).toBe(foldText('سما'));
  });

  it('strips tashkeel — مُحَمَّد is محمد', () => {
    expect(foldText('مُحَمَّد')).toBe('محمد');
  });

  it('strips tatweel — a stretched name is the same name', () => {
    expect(foldText('محـــمد')).toBe('محمد');
  });

  it('lower-cases Latin and collapses whitespace on both scripts', () => {
    expect(foldText('  Ahmed   MOHAMED ')).toBe('ahmed mohamed');
    expect(foldText(' أحمد\t\nمحمد ')).toBe('احمد محمد');
  });

  it('is idempotent — folding a folded key changes nothing', () => {
    const once = foldText('أحمد مصطفى');
    expect(foldText(once)).toBe(once);
  });

  it('returns an empty key for blank input', () => {
    expect(foldText('   ')).toBe('');
  });
});

describe('foldTokens', () => {
  it('splits on collapsed whitespace', () => {
    expect(foldTokens('أحمد  محمد علي')).toEqual(['احمد', 'محمد', 'علي']);
  });

  it('returns an empty array for blank input, not an array holding one empty string', () => {
    expect(foldTokens('  ')).toEqual([]);
  });
});
