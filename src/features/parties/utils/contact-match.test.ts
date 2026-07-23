/**
 * The matcher behind the name-field autofill: Arabic folding, Arabic-Indic
 * digits, out-of-order words, ranking, and the cap that keeps a 4,000-contact
 * address book from janking the form.
 */
import {
  SUGGESTION_LIMIT,
  normalizePhone,
  rankSuggestions,
  scoreName,
  toSuggestion,
  toSuggestions,
} from './contact-match';
import type { ContactSuggestion } from '../types';

const contact = (id: string, name: string, phone: string | null = null): ContactSuggestion => ({
  id,
  name,
  phone,
});

describe('normalizePhone — one rule, applied everywhere', () => {
  it('Latinizes Arabic-Indic digits', () => {
    expect(normalizePhone('٠١٠٠١٢٣٤٥٦٧')).toBe('01001234567');
  });

  it('strips spaces, dashes, parens and dots', () => {
    expect(normalizePhone('(010) 012-345.67')).toBe('01001234567');
  });

  it('keeps a LEADING + and nothing else', () => {
    expect(normalizePhone('+20 100 123 4567')).toBe('+201001234567');
    expect(normalizePhone('010-0+12')).toBe('010012');
  });

  it('does NOT rewrite the country code — no adding +20, no dropping the 0', () => {
    expect(normalizePhone('01001234567')).toBe('01001234567');
    expect(normalizePhone('00201001234567')).toBe('00201001234567');
  });

  it('returns empty for a number with no digits at all', () => {
    expect(normalizePhone('--')).toBe('');
  });
});

describe('toSuggestion — what the device gives us vs what we can use', () => {
  it('takes the FIRST number when a contact has several', () => {
    expect(
      toSuggestion({ id: 'c1', name: 'أحمد', phoneNumbers: [{ number: '0100 1' }, { number: '0111 2' }] }, 'x'),
    ).toEqual({ id: 'c1', name: 'أحمد', phone: '01001' });
  });

  it('keeps a contact that has a name but NO number — phone stays null', () => {
    expect(toSuggestion({ id: 'c2', name: 'فاطمة', phoneNumbers: [] }, 'x')).toEqual({
      id: 'c2',
      name: 'فاطمة',
      phone: null,
    });
  });

  it('skips a blank-number entry and takes the next real one', () => {
    expect(
      toSuggestion({ id: 'c3', name: 'علي', phoneNumbers: [{ number: '  ' }, { number: '0100' }] }, 'x')?.phone,
    ).toBe('0100');
  });

  it('DROPS a contact with a number but no name — there is nothing to match on', () => {
    expect(toSuggestion({ id: 'c4', name: '  ', phoneNumbers: [{ number: '0100' }] }, 'x')).toBeNull();
    expect(toSuggestion({ id: 'c5', phoneNumbers: [{ number: '0100' }] }, 'x')).toBeNull();
  });

  it('falls back to a synthetic id when the device gives none', () => {
    expect(toSuggestions([{ name: 'سيد' }])).toEqual([{ id: 'contact-0', name: 'سيد', phone: null }]);
  });
});

describe('scoreName — Arabic spellings must not hide a contact', () => {
  it('matches across alef variants', () => {
    expect(scoreName('احمد', 'أحمد محمد')).not.toBeNull();
    expect(scoreName('أحمد', 'احمد محمد')).not.toBeNull();
  });

  it('matches across taa marbuta and alef maqsura', () => {
    expect(scoreName('فاطمه', 'فاطمة علي')).not.toBeNull();
    expect(scoreName('مصطفي', 'مصطفى كامل')).not.toBeNull();
  });

  it('matches a name saved WITH tashkeel', () => {
    expect(scoreName('محمد', 'مُحَمَّد سيد')).not.toBeNull();
  });

  it('is case-insensitive and whitespace-tolerant on Latin', () => {
    expect(scoreName('  AHMED ', 'Ahmed Mohamed')).not.toBeNull();
  });

  it('matches words out of order', () => {
    expect(scoreName('محمد احمد', 'أحمد محمد علي')).not.toBeNull();
  });

  it('returns null when nothing matches, and for a blank query', () => {
    expect(scoreName('خالد', 'أحمد محمد')).toBeNull();
    expect(scoreName('   ', 'أحمد')).toBeNull();
    expect(scoreName('أحمد', '')).toBeNull();
  });

  it('ranks exact above prefix above word-prefix above substring above out-of-order', () => {
    const exact = scoreName('أحمد محمد', 'احمد محمد')!;
    const namePrefix = scoreName('أحمد', 'أحمد محمد')!;
    const wordPrefix = scoreName('محمد', 'أحمد محمد')!;
    const substring = scoreName('حمد', 'أحمد')!;
    const unordered = scoreName('محمد احمد', 'أحمد محمد')!;
    expect(exact).toBeLessThan(namePrefix);
    expect(namePrefix).toBeLessThan(wordPrefix);
    expect(wordPrefix).toBeLessThan(substring);
    expect(substring).toBeLessThan(unordered);
  });
});

describe('rankSuggestions', () => {
  const book = [
    contact('1', 'محمود سيد'), // substring-ish
    contact('2', 'أحمد محمد', '01001234567'),
    contact('3', 'محمد علي', '01111111111'),
    contact('4', 'أحمد', '01022222222'),
  ];

  it('puts the exact match first, then the prefix, then the word-prefix', () => {
    expect(rankSuggestions(book, 'احمد').matches.map((c) => c.id)).toEqual(['4', '2']);
    expect(rankSuggestions(book, 'محمد').matches.map((c) => c.id)).toEqual(['3', '2']);
  });

  it('returns nothing for a blank query — an empty box is not a search', () => {
    expect(rankSuggestions(book, '   ')).toEqual({ matches: [], total: 0, truncated: false });
  });

  it('collapses a contact saved twice with the same name and number', () => {
    const dupes = [contact('a', 'أحمد محمد', '01001234567'), contact('b', 'احمد محمد', '01001234567')];
    expect(rankSuggestions(dupes, 'احمد').matches).toHaveLength(1);
  });

  it('KEEPS two people who share a name but not a number', () => {
    const namesakes = [contact('a', 'أحمد محمد', '01001234567'), contact('b', 'أحمد محمد', '01099999999')];
    expect(rankSuggestions(namesakes, 'احمد').matches).toHaveLength(2);
  });

  it('caps a huge address book and reports the truncation', () => {
    const many = Array.from({ length: 500 }, (_, i) => contact(String(i), `محمد ${i}`));
    const ranked = rankSuggestions(many, 'محمد');
    expect(ranked.matches).toHaveLength(SUGGESTION_LIMIT);
    expect(ranked.total).toBe(500);
    expect(ranked.truncated).toBe(true);
  });

  it('does not claim truncation when everything fit', () => {
    expect(rankSuggestions(book, 'احمد').truncated).toBe(false);
  });

  it('finds a mixed-script address book from either script', () => {
    const mixed = [contact('1', 'Ahmed Mohamed'), contact('2', 'أحمد محمد')];
    expect(rankSuggestions(mixed, 'ahmed').matches.map((c) => c.id)).toEqual(['1']);
    expect(rankSuggestions(mixed, 'احمد').matches.map((c) => c.id)).toEqual(['2']);
  });
});
