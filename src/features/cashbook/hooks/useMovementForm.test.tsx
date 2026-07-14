/**
 * THE CASH-BOOK MOVEMENT SHEET — the drawer's last line of defence.
 *
 * Every other screen records money that moved because something else happened
 * (a sale, a purchase, a payment). This sheet records the movements NOTHING else
 * can record — the 200 the owner took out for lunch, the transfer from the
 * drawer to InstaPay. If it writes a bad row, or writes half a transfer, the
 * app's cash figure drifts away from the notes in the drawer, and that drift is
 * the one thing this feature exists to prevent.
 *
 * The repositories here are REAL, over an in-memory better-sqlite3 db, so
 * `amount > 0` is enforced by the actual CHECK constraint and a transfer's
 * atomicity by the actual SQL transaction — not by a jest.fn() that agrees with
 * whatever it is handed.
 */
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@/i18n';
import { repos as mockRepos } from '@/testing/hook-repos';
import { alertCount, lastAlert } from '@/testing/alerts';
import { useMovementForm } from './useMovementForm';

jest.mock('@/repositories/transaction-repository.client', () => ({
  get transactionRepository() {
    return mockRepos.transactions;
  },
}));

const onSaved = jest.fn();

const setup = () => renderHook(() => useMovementForm({ visible: true, onSaved }));

/** Every live row in the cash book, whatever its kind. */
const allRows = () => mockRepos.transactions.listForCashBook();

describe('useMovementForm — the amount box', () => {
  it('refuses an EMPTY amount: nothing is written, and the refusal is localized', async () => {
    const { result } = await setup();

    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
    expect(alertCount()).toBe(1);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
    // Localized — not a raw key echoed back by a missing translation.
    expect(lastAlert()?.message).not.toBe('payments.errors.amountRequired');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses ZERO — the CHECK constraint forbids amount 0, and so does the sheet', async () => {
    const { result } = await setup();

    await act(() => result.current.setAmount('0'));
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
  });

  it('refuses a NEGATIVE amount — the sign lives in `direction`, never in `amount`', async () => {
    const { result } = await setup();

    await act(() => result.current.setAmount('-50'));

    expect(result.current.canSave).toBe(false);
    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
  });

  it('refuses GARBAGE — letters do not quietly become 0 and then a row', async () => {
    const { result } = await setup();

    await act(() => result.current.setAmount('abc'));

    expect(result.current.canSave).toBe(false);
    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
  });

  it('parses ARABIC-INDIC digits — "٢٠٠٫٥٠" is 20050 minor units, not NaN, not 0', async () => {
    const { result } = await setup();

    await act(() => result.current.setAmount('٢٠٠٫٥٠'));

    // Canonical in the draft, shaped on the way to the screen.
    expect(result.current.draft.amount).toBe('200.50');
    expect(result.current.amountValue).toBe('٢٠٠٫٥٠');
    expect(result.current.canSave).toBe(true);

    await act(() => result.current.submit());

    const rows = allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(20050);
  });
});

describe('useMovementForm — a drawing', () => {
  it('writes ONE row OUT of the named pocket, pointing at nobody', async () => {
    const { result } = await setup();

    await act(() => result.current.setType('drawing'));
    await act(() => result.current.setAmount('200'));
    await act(() => result.current.submit());

    const rows = allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: -1,
      amount: 20000,
      account: 'cash',
      refKind: 'owner',
      refId: null,
      occurredAt: 1_760_000_000_000,
    });
    // The drawer went down by exactly the drawing; InstaPay never moved.
    expect(mockRepos.transactions.balances()).toMatchObject({ cash: -20000, instapay: 0 });
  });

  it('confirms in NUMBERS, so the owner never re-enters it "to be safe"', async () => {
    const { result } = await setup();

    await act(() => result.current.setAmount('200'));
    await act(() => result.current.submit());

    expect(lastAlert()?.title).toBe(i18n.t('cashbook.saved.title'));
    // "طلعت ٢٠٠٫٠٠ ج.م من نقدي" — major units, shaped. Never raw minor units:
    // "طلعت 20000" is not a sentence about 200 pounds.
    expect(lastAlert()?.message).toContain('٢٠٠٫٠٠');
    expect(lastAlert()?.message).not.toContain('20000');
  });
});

describe('useMovementForm — a transfer', () => {
  it('has a destination BY CONSTRUCTION — it can never be missing, nor equal the source', async () => {
    const { result } = await setup();

    await act(() => result.current.setType('transfer'));

    // The destination is DERIVED (`other(account)`), never typed: there is no
    // field to leave blank and no way to pick the source twice. This assertion
    // guards that design — the day `toAccount` becomes a free choice, this fails
    // and the two-legged guarantees below stop being structural.
    expect(result.current.toAccount).toBe('instapay');
    expect(result.current.toAccount).not.toBe(result.current.draft.account);

    await act(() => result.current.setAccount('instapay'));
    expect(result.current.toAccount).toBe('cash');
    expect(result.current.toAccount).not.toBe(result.current.draft.account);
  });

  it('writes BOTH legs — out of one pocket, into the other, netting to zero', async () => {
    const { result } = await setup();

    await act(() => result.current.setType('transfer'));
    await act(() => result.current.setAmount('500'));
    await act(() => result.current.submit());

    const rows = allRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.refKind === 'transfer')).toBe(true);
    expect(rows.map((r) => `${r.direction}:${r.account}:${r.amount}`).sort()).toEqual(
      ['-1:cash:50000', '1:instapay:50000'].sort(),
    );

    // The money MOVED — it did not appear or vanish. The pockets changed; the sum did not.
    const balances = mockRepos.transactions.balances();
    expect(balances.cash).toBe(-50000);
    expect(balances.instapay).toBe(50000);
    expect(balances.total).toBe(0);
  });

  it('writes NEITHER leg when the amount is not a movement — no half transfer, ever', async () => {
    const { result } = await setup();

    await act(() => result.current.setType('transfer'));
    await act(() => result.current.setAmount('0'));
    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
  });

  it('rolls BOTH legs back when the second one cannot be written — atomic, or nothing', async () => {
    const { result } = await setup();
    // Poison the IN leg so it fails INSIDE the db transaction. One surviving row
    // would be money DESTROYED: a drawer down 500 that arrived nowhere. Both legs
    // go through one `createMany` → one SQL transaction → the first must roll back.
    const real = mockRepos.transactions.createMany;
    jest
      .spyOn(mockRepos.transactions, 'createMany')
      .mockImplementation((inputs) => real([inputs[0], { ...inputs[1], amount: 0 }]));

    await act(() => result.current.setType('transfer'));
    await act(() => result.current.setAmount('500'));
    await act(() => result.current.submit());

    expect(allRows()).toHaveLength(0);
    expect(lastAlert()?.title).toBe(i18n.t('cashbook.errors.title'));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
