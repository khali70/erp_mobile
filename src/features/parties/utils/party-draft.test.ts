/**
 * THE NAME MUST SURVIVE THE PHONE FIELD.
 *
 * The one rule the contact-autofill feature exists to guarantee: typing into
 * the phone box changes the phone and NOTHING else. This suite is the guard on
 * `withPhone`; if someone ever "improves" it into a reverse-lookup that fills
 * the name from a matched contact, these fail immediately.
 */
import { EMPTY_DRAFT, withContact, withName, withPhone } from './party-draft';
import type { ContactSuggestion, PartyDraft } from '../types';

const typed: PartyDraft = { name: 'محل الحاج سيد', phone: '' };

describe('withPhone — only the phone moves', () => {
  it('keeps a name the owner typed himself', () => {
    expect(withPhone(typed, '01001234567')).toEqual({
      name: 'محل الحاج سيد',
      phone: '01001234567',
    });
  });

  it('keeps the name for EVERY shape of phone input, including one that is a real contact number', () => {
    const inputs = [
      '',
      '0',
      '0100',
      '01001234567',
      '+201001234567',
      '٠١٠٠١٢٣٤٥٦٧',
      '010 012 34567',
      'أحمد', // even a NAME pasted into the phone box may not become the name
    ];
    for (const input of inputs) {
      expect(withPhone(typed, input).name).toBe(typed.name);
    }
  });

  it('keeps a name that came from a contact pick', () => {
    const picked = withContact(EMPTY_DRAFT, { id: 'c1', name: 'أحمد محمد', phone: '01111111111' });
    expect(withPhone(picked, '02222222222')).toEqual({
      name: 'أحمد محمد',
      phone: '02222222222',
    });
  });

  it('never mutates the draft it was given', () => {
    const before = { ...typed };
    withPhone(typed, '01099999999');
    expect(typed).toEqual(before);
  });

  it('clearing the phone leaves the name standing', () => {
    expect(withPhone({ name: 'مورد الدقيق', phone: '0100' }, '')).toEqual({
      name: 'مورد الدقيق',
      phone: '',
    });
  });
});

describe('withName — the mirror image', () => {
  it('changes the name and carries the phone across untouched', () => {
    expect(withName({ name: 'أ', phone: '01001234567' }, 'أحمد')).toEqual({
      name: 'أحمد',
      phone: '01001234567',
    });
  });
});

describe('withContact — the only both-fields transition', () => {
  const withPhoneContact: ContactSuggestion = { id: 'c1', name: 'أحمد محمد', phone: '01001234567' };
  const noPhoneContact: ContactSuggestion = { id: 'c2', name: 'فاطمة علي', phone: null };

  it('fills name AND phone from the tapped row', () => {
    expect(withContact({ name: 'أح', phone: '' }, withPhoneContact)).toEqual({
      name: 'أحمد محمد',
      phone: '01001234567',
    });
  });

  it('a contact with no number fills the name and LEAVES the typed phone alone', () => {
    expect(withContact({ name: 'فا', phone: '01055555555' }, noPhoneContact)).toEqual({
      name: 'فاطمة علي',
      phone: '01055555555',
    });
  });

  it('writes the contact spelling verbatim — no folding leaks into stored data', () => {
    const marked: ContactSuggestion = { id: 'c3', name: 'مُحَمَّد أحمد', phone: null };
    expect(withContact(EMPTY_DRAFT, marked).name).toBe('مُحَمَّد أحمد');
  });
});
