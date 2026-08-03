/**
 * THE OUTGOING FORM, AGAINST WHAT IS ACTUALLY ON THE SHELF.
 *
 * The old shape of this failure: the owner picks an item the shop ran out of
 * three days ago, types 12, builds a 14-line invoice, taps حفظ — and gets
 * "الكمية المطلوبة تتجاوز الرصيد المتاح.": no item named, no quantity, after the
 * work is done. The constraint lived only in the repository, and by the time it
 * spoke, it could only say no.
 *
 * So the constraint moved FORWARD — into the picker, the stepper and the scanner.
 * These tests hold that forward move to three things it must not get wrong:
 *
 *  1. THE CEILING IS ON THE SUM. Two rows of one item share one ceiling. A clamp
 *     that only looks at the row it is on passes every obvious test and still
 *     oversells (see `sells the SAME item on two rows` below).
 *  2. `allowNegativeStock` IS THE SOLE GATE. Flip it and every restriction here
 *     must vanish — reactively, mid-session, without remounting the form.
 *  3. THE REPOSITORY IS STILL THE AUTHORITY. `f.items` is a snapshot; another
 *     document can post behind this form's back. When it does, the guard fires,
 *     and the message must still NAME the item.
 *
 * The repositories are REAL (in-memory better-sqlite3, the app's DDL): the
 * `NegativeStockError` these tests catch is thrown by the same SQL the shop runs.
 */
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@/i18n';
import { repos as mockRepos } from '@/testing/hook-repos';
import { alerts, lastAlert } from '@/testing/alerts';
import { WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { useSettingsStore } from '@/store/settings-store';
import type { DocMode } from '../types';
import { useDocumentForm } from './useDocumentForm';

jest.mock('@/repositories/document-repository.client', () => ({
  get documentRepository() {
    return mockRepos.documents;
  },
}));
jest.mock('@/repositories/item-repository.client', () => ({
  get itemRepository() {
    return mockRepos.items;
  },
}));
jest.mock('@/repositories/tag-repository.client', () => ({
  get tagRepository() {
    return mockRepos.tags;
  },
}));
jest.mock('@/repositories/supplier-repository.client', () => ({
  get supplierRepository() {
    return mockRepos.suppliers;
  },
}));
jest.mock('@/repositories/customer-repository.client', () => ({
  get customerRepository() {
    return mockRepos.customers;
  },
}));
jest.mock('@/repositories/debt-repository.client', () => ({
  get debtRepository() {
    return mockRepos.debts;
  },
}));
// The hook marks a voice note processed after a save. Its `.client` singleton
// binds expo-sqlite AND expo-file-system at import time, so it has to be swapped
// here too, otherwise merely importing the hook opens the real database.
jest.mock('@/repositories/voice-note-repository.client', () => ({
  get voiceNoteRepository() {
    return mockRepos.voiceNotes;
  },
}));

/** The setting is a persisted singleton — reset it, or one test arms the next. */
beforeEach(() => {
  useSettingsStore.setState({ allowNegativeStock: false });
});

/** A catalog item with `qty` on hand — the stock comes from a posted purchase. */
function seedItem(name: string, onHand: number, salePrice = 2000) {
  const item = mockRepos.items.create({ name, costPrice: 1260, salePrice });
  if (onHand > 0) {
    mockRepos.documents.create({
      kind: 'incoming',
      status: 'posted',
      partyId: WALKIN_SUPPLIER_ID,
      lines: [{ itemId: item.id, qty: onHand, unitPrice: 1260 }],
      payments: [{ amount: 1260 * onHand, account: 'cash' }],
    });
  }
  return item;
}

/** Sell `qty` of an item BEHIND the form's back — the on-hand it holds goes stale. */
function sellBehindTheFormsBack(itemId: string, qty: number, unitPrice = 2000) {
  mockRepos.documents.create({
    kind: 'outgoing',
    status: 'posted',
    partyId: mockRepos.customers.create({ name: 'زبون آخر' }).id,
    lines: [{ itemId, qty, unitPrice }],
    payments: [{ amount: unitPrice * qty, account: 'cash' }],
  });
}

/**
 * Mount the form and FLUSH it. The initial render (and `useItems`' load effect)
 * has to commit inside `act` — otherwise `result.current` is still null and the
 * first assertion reads a form that has not run yet.
 */
const render = async (mode: DocMode = 'sale') => {
  let view!: ReturnType<typeof renderHook<ReturnType<typeof useDocumentForm>, unknown>>;
  await act(async () => {
    view = renderHook(() => useDocumentForm(mode));
  });
  return view;
};

/**
 * Flip the escape hatch. It is a LIVE Zustand selector, so setting it re-renders
 * every mounted form — inside `act`, so React commits it before we look.
 */
const setAllowNegative = async (v: boolean) => {
  await act(async () => {
    useSettingsStore.setState({ allowNegativeStock: v });
  });
};
const itemNamed = (result: { current: { items: { id: string; name: string }[] } }, name: string) =>
  result.current.items.find((i) => i.name === name)!;
const saleDocs = () => mockRepos.documents.list({ status: 'posted' }).filter((d) => d.kind === 'out');
const qtyOf = (result: { current: { lines: { qty: number }[] } }, i = 0) => result.current.lines[i].qty;

// ─────────────────────────────────────────────────────────────────────────────
// AC 1 — an empty item cannot get onto an outgoing document, by any door
// ─────────────────────────────────────────────────────────────────────────────
describe('the picker refuses what the shop does not have', () => {
  it('an item with 0 on hand cannot be added — the tap is a NO-OP, not a line', async () => {
    seedItem('زيت', 0);
    const { result } = await render();

    const empty = itemNamed(result, 'زيت');
    expect(result.current.stock.canAdd(empty)).toBe(false); // the row renders disabled
    await act(() => result.current.appendItem(empty));

    expect(result.current.lines).toHaveLength(0);
  });

  it('an item with stock adds normally, and stops being addable once fully claimed', async () => {
    seedItem('زيت', 3);
    const { result } = await render();

    const oil = itemNamed(result, 'زيت');
    expect(result.current.stock.canAdd(oil)).toBe(true);
    await act(() => result.current.appendItem(oil));
    await act(() => result.current.setQty(result.current.lines[0].id, 3)); // all three

    // In stock, and yet there is nothing left to give: this document has it all.
    expect(result.current.stock.headroomFor(oil.id)).toBe(0);
    expect(result.current.stock.canAdd(oil)).toBe(false);
  });

  it('a SCAN of an empty item is refused out loud — never silently appended', async () => {
    seedItem('زيت', 0);
    const { result } = await render();

    let outcome!: ReturnType<typeof result.current.scanAppend>;
    await act(() => {
      outcome = result.current.scanAppend(itemNamed(result, 'زيت'));
    });

    expect(outcome).toEqual({ ok: false, name: 'زيت', available: 0 });
    expect(result.current.lines).toHaveLength(0);
  });

  it('a repeat SCAN at the ceiling does not bump the line — it reports the ceiling', async () => {
    seedItem('زيت', 2);
    const { result } = await render();
    const oil = itemNamed(result, 'زيت');

    await act(() => void result.current.scanAppend(oil)); // qty 1
    await act(() => void result.current.scanAppend(oil)); // qty 2 — that is all of it
    expect(qtyOf(result)).toBe(2);

    let third!: ReturnType<typeof result.current.scanAppend>;
    await act(() => {
      third = result.current.scanAppend(oil);
    });

    expect(third).toEqual({ ok: false, name: 'زيت', available: 2 });
    expect(qtyOf(result)).toBe(2); // the third scan did NOT become a third unit
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 2 — the ceiling, and the SUM across duplicate lines
// ─────────────────────────────────────────────────────────────────────────────
describe('the quantity ceiling', () => {
  it('the + stepper stops at on-hand, and the typed box clamps DOWN to it', async () => {
    seedItem('زيت', 5);
    const { result } = await render();
    await act(() => result.current.appendItem(itemNamed(result, 'زيت')));
    const lineId = result.current.lines[0].id;

    await act(() => result.current.setQty(lineId, 99)); // he types 99 of the 5 he owns
    expect(qtyOf(result)).toBe(5);
    expect(result.current.stock.maxQtyById[lineId]).toBe(5); // the row shows "only 5 available"

    await act(() => result.current.mutateQty(lineId, 1)); // and + is disabled at the ceiling
    expect(qtyOf(result)).toBe(5);

    await act(() => result.current.mutateQty(lineId, -1)); // − is untouched
    expect(qtyOf(result)).toBe(4);
  });

  it('sells the SAME item on two rows against ONE shared ceiling — not two', async () => {
    // THE BUG A PER-ROW CLAMP CANNOT SEE. 10 on hand, two rows. Row-by-row, each
    // row may reach 10 and both are "valid" — and he has sold 20 of the 10 he has.
    seedItem('زيت', 10);
    const { result } = await render();
    const oil = itemNamed(result, 'زيت');

    await act(() => result.current.appendItem(oil));
    await act(() => result.current.appendItem(oil)); // the same item, a second row
    const [a, b] = result.current.lines.map((l) => l.id);

    await act(() => result.current.setQty(a, 6));
    // The ceiling for the other row is now 4 — what the FIRST row left behind.
    expect(result.current.stock.maxQtyById[b]).toBe(4);

    await act(() => result.current.setQty(b, 10)); // he asks for all ten, again
    expect(qtyOf(result, 1)).toBe(4);

    const requested = result.current.lines.reduce((sum, l) => sum + l.qty, 0);
    expect(requested).toBe(10); // exactly what is on the shelf — never 16, never 20
    expect(result.current.stock.violations).toEqual([]);
  });

  it('leaves a fast-entry line (itemId null) unbounded — its item does not exist yet', async () => {
    const { result } = await render();

    await act(() => result.current.setQuickField('title', 'شنطة'));
    await act(() => result.current.setQuickField('qty', '50'));
    await act(() => result.current.addQuickLine());
    const lineId = result.current.lines[0].id;

    expect(result.current.lines[0].itemId).toBeNull();
    expect(result.current.stock.maxQtyById[lineId]).toBeNull(); // no ceiling to apply
    await act(() => result.current.setQty(lineId, 500));
    expect(qtyOf(result)).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 5 — the save-time pre-check: one message, every item named, nothing written
// ─────────────────────────────────────────────────────────────────────────────
describe('save, when the form already knows it overdraws', () => {
  it('NAMES each offending item with requested vs available, and creates NOTHING', async () => {
    // A restored draft is how this is reached in the shop: yesterday's quantities
    // against today's shelf. The lines are built while the clamp is off, exactly
    // as MMKV would re-hydrate them.
    const oil = seedItem('زيت', 3);
    const sugar = seedItem('سكر', 0, 1000);
    await setAllowNegative(true); // build over-stock lines…
    const { result } = await render();
    mockRepos.customers.create({ name: 'زبون' });

    await act(() => result.current.appendItem(itemNamed(result, 'زيت')));
    await act(() => result.current.appendItem(itemNamed(result, 'سكر')));
    await act(() => result.current.setQty(result.current.lines[0].id, 8));
    await act(() => result.current.setQty(result.current.lines[1].id, 2));

    await setAllowNegative(false); // …then the gate closes on the lines he already has

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    const msg = lastAlert()?.message ?? '';
    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(msg).toContain(i18n.t('documents.errors.negativeStock'));
    // The point of the whole feature: he is told WHICH items and BY HOW MUCH.
    expect(msg).toContain(
      i18n.t('documents.errors.negativeStockDetail', { name: 'زيت', requested: '٨', available: '٣' }),
    );
    expect(msg).toContain(
      i18n.t('documents.errors.negativeStockDetail', { name: 'سكر', requested: '٢', available: '٠' }),
    );
    expect(msg).not.toBe('documents.errors.negativeStockDetail'); // localized, not a raw key

    // ONE alert — consolidated, not one per line. And nothing was sent.
    expect(alerts()).toHaveLength(1);
    expect(saleDocs()).toHaveLength(0);
    expect(mockRepos.documents.onHand(oil.id)).toBe(3);
    expect(mockRepos.documents.onHand(sugar.id)).toBe(0);
    // His work survives the refusal — the lines are still on screen, unrewritten.
    expect(result.current.lines.map((l) => l.qty)).toEqual([8, 2]);
    expect(result.current.stock.overLines).toHaveLength(2); // …and both are flagged
  });

  it('a document within stock still posts, and the stock is drawn down', async () => {
    const oil = seedItem('زيت', 5);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await render();

    await act(() => result.current.appendItem(itemNamed(result, 'زيت')));
    await act(() => result.current.setQty(result.current.lines[0].id, 5)); // exact-to-zero
    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.saved'));
    expect(saleDocs()).toHaveLength(1);
    expect(mockRepos.documents.onHand(oil.id)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 6 — the repository backstop, when the form's on-hand has gone stale
// ─────────────────────────────────────────────────────────────────────────────
describe('the repository is still the authority', () => {
  it('a sale that went through on ANOTHER document is caught at post — and NAMED', async () => {
    // The form opened when there were 5. It still believes there are 5. In the
    // meantime the owner sold 4 from the other screen, so the pre-check sees
    // nothing wrong and sends a document the ledger must refuse.
    const oil = seedItem('زيت', 5);
    mockRepos.customers.create({ name: 'زبون' });
    const { result } = await render();

    await act(() => result.current.appendItem(itemNamed(result, 'زيت')));
    await act(() => result.current.setQty(result.current.lines[0].id, 5));
    await act(() => result.current.selectParty(result.current.parties[0]));

    sellBehindTheFormsBack(oil.id, 4); // on-hand is really 1 now
    expect(result.current.stock.onHand[oil.id]).toBe(5); // the form's snapshot is STALE
    expect(result.current.stock.violations).toEqual([]); // …so the pre-check passes

    await act(() => result.current.save());

    // The guard fired inside the transaction. The alert is no longer generic: it
    // reads the violations off the error and names the item.
    const msg = lastAlert()?.message ?? '';
    expect(lastAlert()?.title).toBe(i18n.t('documents.errors.title'));
    expect(msg).toContain('زيت');
    expect(msg).toContain(
      i18n.t('documents.errors.negativeStockDetail', { name: 'زيت', requested: '٥', available: '١' }),
    );
    expect(msg).not.toContain('NegativeStockError'); // a sentence, not a stack

    // The sale rolled back whole: no second sale doc, and the 1 remaining is intact.
    expect(saleDocs()).toHaveLength(1); // only the one posted behind its back
    expect(mockRepos.documents.onHand(oil.id)).toBe(1);
    expect(result.current.lines).toHaveLength(1); // and his draft is untouched
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 4 — allowNegativeStock is the sole gate: every behaviour above reverts
// ─────────────────────────────────────────────────────────────────────────────
describe('allowNegativeStock = true reverts EVERY new restriction', () => {
  it('picker, stepper, scanner and pre-check all behave exactly as they did before', async () => {
    // Both priced ABOVE cost: this test is about the stock gate, and a below-cost
    // line would raise the (unrelated) "بيع بخسارة" confirm on the way to the save.
    const oil = seedItem('زيت', 2);
    seedItem('سكر', 0);
    mockRepos.customers.create({ name: 'زبون' });
    await setAllowNegative(true);
    const { result } = await render();

    expect(result.current.stock.enforced).toBe(false);

    // 1. the picker offers the empty item, and it adds
    const sugar = itemNamed(result, 'سكر');
    expect(result.current.stock.canAdd(sugar)).toBe(true);
    await act(() => result.current.appendItem(sugar));
    expect(result.current.lines).toHaveLength(1);

    // 2. the scanner appends it instead of refusing
    let scanned!: ReturnType<typeof result.current.scanAppend>;
    await act(() => {
      scanned = result.current.scanAppend(itemNamed(result, 'زيت'));
    });
    expect(scanned).toEqual({ ok: true, qty: 1 });

    // 3. there is no ceiling: 99 of the 2 he owns, and no hint on the row
    const oilLine = result.current.lines[1].id;
    await act(() => result.current.setQty(oilLine, 99));
    expect(qtyOf(result, 1)).toBe(99);
    expect(result.current.stock.maxQtyById[oilLine]).toBeNull();
    await act(() => result.current.mutateQty(oilLine, 1));
    expect(qtyOf(result, 1)).toBe(100);

    // 4. no pre-check, no violations, nothing flagged
    expect(result.current.stock.violations).toEqual([]);
    expect(result.current.stock.overLines).toEqual([]);

    // 5. …and the save goes through, driving on-hand negative, as it always could
    await act(() => result.current.setQty(result.current.lines[0].id, 4)); // 4 sugar from 0
    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.saved'));
    expect(saleDocs()).toHaveLength(1);
    expect(mockRepos.documents.onHand(oil.id)).toBe(2 - 100);
  });

  it('lifts the clamps REACTIVELY when toggled mid-session — no remount', async () => {
    // It is a live Zustand selector, not a value snapshotted at mount. If it were
    // snapshotted, the owner would flip the setting, see nothing change, and flip
    // it back — concluding the escape hatch is broken.
    seedItem('زيت', 2);
    const { result } = await render();
    await act(() => result.current.appendItem(itemNamed(result, 'زيت')));
    const lineId = result.current.lines[0].id;

    await act(() => result.current.setQty(lineId, 9));
    expect(qtyOf(result)).toBe(2); // clamped, gate closed

    // No remount, no re-render by hand: the form is SUBSCRIBED to the setting.
    await setAllowNegative(true);

    expect(result.current.stock.enforced).toBe(false);
    expect(result.current.stock.maxQtyById[lineId]).toBeNull();
    await act(() => result.current.setQty(lineId, 9));
    expect(qtyOf(result)).toBe(9); // the same keystroke, now allowed
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC 7 — the incoming (purchase) flow is provably untouched
// ─────────────────────────────────────────────────────────────────────────────
describe('the PURCHASE form carries no ceilings at all', () => {
  it('buys 100 of an item that is empty — you cannot overdraw what you are adding', async () => {
    const item = seedItem('زيت', 0);
    mockRepos.suppliers.create({ name: 'أحمد' });
    const { result } = await render('purchase');

    expect(result.current.stock.enforced).toBe(false);

    const oil = itemNamed(result, 'زيت');
    expect(result.current.stock.canAdd(oil)).toBe(true); // 0 on hand, still addable
    await act(() => result.current.appendItem(oil));
    const lineId = result.current.lines[0].id;

    await act(() => result.current.setPrice(lineId, 12.6));
    await act(() => result.current.setQty(lineId, 100));
    expect(qtyOf(result)).toBe(100); // no clamp
    expect(result.current.stock.maxQtyById[lineId]).toBeNull();

    await act(() => result.current.selectParty(result.current.parties[0]));
    await act(() => result.current.save());

    expect(lastAlert()?.title).toBe(i18n.t('documents.saved'));
    expect(mockRepos.documents.onHand(item.id)).toBe(100);
  });
});
