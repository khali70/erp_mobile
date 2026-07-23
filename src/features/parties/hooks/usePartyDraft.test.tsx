/**
 * THE PHONE BOX MAY NOT TOUCH THE NAME — asserted through the real hook, not
 * only through the pure transitions underneath it (party-draft.test.ts).
 *
 * This is the wiring test: it proves that the updater the form actually calls
 * is the phone-only one, and that opening the sheet on a saved party never
 * rewrites what was stored.
 */
import { renderHook, act } from '@testing-library/react-native';
import { usePartyDraft } from './usePartyDraft';
import type { PartyDraft } from '../types';

const open = (initial: PartyDraft | null = null) =>
  renderHook(({ visible, init }) => usePartyDraft(visible, init), {
    initialProps: { visible: true, init: initial },
  });

describe('usePartyDraft — the phone field is phone-only', () => {
  it('typing a number leaves a hand-typed name exactly as typed', async () => {
    const { result } = await open();
    await act(() => result.current.setName('محل الحاج سيد'));
    await act(() => result.current.setPhone('01001234567'));
    expect(result.current.draft).toEqual({ name: 'محل الحاج سيد', phone: '01001234567' });
  });

  it('retyping the phone over and over never disturbs the name', async () => {
    const { result } = await open();
    await act(() => result.current.setName('أحمد محمد'));
    for (const digits of ['0', '01', '010', '٠١٠٠', '+201001234567', '']) {
      await act(() => result.current.setPhone(digits));
      expect(result.current.draft.name).toBe('أحمد محمد');
    }
  });

  it('typing a number after picking a contact keeps the CONTACT name', async () => {
    const { result } = await open();
    await act(() => result.current.pickContact({ id: 'c1', name: 'فاطمة علي', phone: '01111111111' }));
    await act(() => result.current.setPhone('01099999999'));
    expect(result.current.draft).toEqual({ name: 'فاطمة علي', phone: '01099999999' });
  });
});

describe('usePartyDraft — picking a contact', () => {
  it('fills both fields from the tapped row', async () => {
    const { result } = await open();
    await act(() => result.current.setName('أح'));
    await act(() => result.current.pickContact({ id: 'c1', name: 'أحمد محمد', phone: '01001234567' }));
    expect(result.current.draft).toEqual({ name: 'أحمد محمد', phone: '01001234567' });
  });

  it('a contact with no number fills the name and leaves the typed phone standing', async () => {
    const { result } = await open();
    await act(() => result.current.setPhone('01055555555'));
    await act(() => result.current.pickContact({ id: 'c2', name: 'فاطمة علي', phone: null }));
    expect(result.current.draft).toEqual({ name: 'فاطمة علي', phone: '01055555555' });
  });
});

describe('usePartyDraft — edit mode never overwrites a saved party', () => {
  const stored: PartyDraft = { name: 'مورد الدقيق', phone: '01234567890' };

  it('pre-fills from the stored row', async () => {
    const { result } = await open(stored);
    expect(result.current.draft).toEqual(stored);
  });

  it('a parent re-render (new `initial` object, same values) does NOT discard edits', async () => {
    const { result, rerender } = await open(stored);
    await act(() => result.current.setName('مورد الدقيق والسكر'));
    // The list screen re-renders and hands down a fresh object literal.
    await rerender({ visible: true, init: { ...stored } });
    expect(result.current.draft.name).toBe('مورد الدقيق والسكر');
  });

  it('reopening on another party loads that party, not the last one', async () => {
    const { result, rerender } = await open(stored);
    await act(() => result.current.setName('مسودة قديمة'));
    await rerender({ visible: false, init: stored });
    const other: PartyDraft = { name: 'أحمد محمد', phone: '01001234567' };
    await rerender({ visible: true, init: other });
    expect(result.current.draft).toEqual(other);
  });
});

describe('usePartyDraft — canSave', () => {
  it('needs a name, and whitespace is not a name', async () => {
    const { result } = await open();
    expect(result.current.canSave).toBe(false);
    await act(() => result.current.setName('   '));
    expect(result.current.canSave).toBe(false);
    await act(() => result.current.setName('أحمد'));
    expect(result.current.canSave).toBe(true);
  });

  it('a phone alone never unlocks save', async () => {
    const { result } = await open();
    await act(() => result.current.setPhone('01001234567'));
    expect(result.current.canSave).toBe(false);
  });
});
