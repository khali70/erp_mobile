/**
 * THE سداد SHEET — one row, and everything downstream depends on it being right.
 *
 * A payment is a single standalone `transactions` row pointing at the supplier.
 * Debt is the SUBTRACTION between the invoices and these rows, so a row that is
 * zero, negative, mis-parsed or mis-kinded does not fail loudly — it just makes
 * the debts screen lie.
 *
 * Real repositories, real SQL, real CHECK constraints: `amount > 0` is enforced
 * by the database, and the FIFO debt walk that the assertions read is the one
 * the app ships.
 */
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@/i18n';
import { repos as mockRepos, T0 } from '@/testing/hook-repos';
import { alertCount, lastAlert, pressAlertButton } from '@/testing/alerts';
import type { SettleTarget } from '../types';
import { useSettlePayment } from './useSettlePayment';

jest.mock('@/repositories/transaction-repository.client', () => ({
  get transactionRepository() {
    return mockRepos.transactions;
  },
}));

const onSaved = jest.fn();

/** A supplier we owe 2520 piastres (25.20) — the float-tail figure, on purpose. */
function owingSupplier() {
  const supplier = mockRepos.suppliers.create({ name: 'أحمد' });
  const item = mockRepos.items.create({ name: 'زيت', costPrice: 1260, salePrice: 2000 });
  mockRepos.documents.create({
    kind: 'incoming',
    status: 'posted',
    partyId: supplier.id,
    lines: [{ itemId: item.id, qty: 2, unitPrice: 1260 }],
    payments: [], // nothing handed over: the whole 25.20 is debt
  });
  return supplier;
}

const targetFor = (id: string): SettleTarget => ({ refKind: 'supplier', refId: id });

const setup = (supplierId: string, suggestedAmount?: number) =>
  renderHook(() =>
    useSettlePayment({
      target: targetFor(supplierId),
      visible: true,
      suggestedAmount,
      payeeName: 'أحمد',
      onSaved,
    }),
  );

const rowsFor = (supplierId: string) => mockRepos.transactions.listByRef('supplier', supplierId);

describe('useSettlePayment — the amount box', () => {
  it('refuses an EMPTY amount with a LOCALIZED message, and writes nothing', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id); // opened with no suggestion

    expect(result.current.draft.amount).toBe('');
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(alertCount()).toBe(1);
    expect(lastAlert()?.title).toBe(i18n.t('payments.errors.title'));
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
    expect(lastAlert()?.message).not.toBe('payments.errors.amountRequired'); // really translated
    expect(rowsFor(supplier.id)).toHaveLength(0);
    expect(mockRepos.debts.owed(supplier.id)).toBe(2520); // the debt is untouched
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses ZERO — `transactions.amount > 0` is a CHECK, not a preference', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id);

    await act(() => result.current.setAmount('0'));
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(rowsFor(supplier.id)).toHaveLength(0);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
  });

  it('refuses a NEGATIVE amount — a payment is not a refund with a minus sign', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id);

    await act(() => result.current.setAmount('-100'));
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(rowsFor(supplier.id)).toHaveLength(0);
    expect(lastAlert()?.message).toBe(i18n.t('payments.errors.amountRequired'));
  });

  it('refuses GARBAGE — letters must not silently become a zero-amount row', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id);

    await act(() => result.current.setAmount('abc'));
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(rowsFor(supplier.id)).toHaveLength(0);
  });

  it('parses ARABIC-INDIC digits — "٢٥٫٢٠" is 2520 minor units, not NaN, not 0', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id);

    await act(() => result.current.setAmount('٢٥٫٢٠'));

    expect(result.current.draft.amount).toBe('25.20'); // canonical in state
    expect(result.current.amountValue).toBe('٢٥٫٢٠'); // shaped on the way out
    expect(result.current.canSave).toBe(true);

    await act(() => result.current.submit());

    const rows = rowsFor(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(2520);
    // And the debt it was paid against is GONE — the whole point of the digits
    // parsing right. A NaN here would have written 0 (or nothing) and left the
    // owner still owing a bill he has just settled.
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });

  it('pre-fills the outstanding balance through toMajor — "25.20", never a float tail', async () => {
    const supplier = owingSupplier();
    const owed = mockRepos.debts.owed(supplier.id);
    expect(owed).toBe(2520);

    const { result } = await setup(supplier.id, owed);

    expect(result.current.draft.amount).toBe('25.20');
    expect(result.current.draft.amount).not.toMatch(/\d{6,}/); // no 25.200000000000003
    expect(result.current.amountValue).toBe('٢٥٫٢٠');
  });
});

describe('useSettlePayment — the write', () => {
  it('writes exactly ONE row, direction −1, pointing at the supplier', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAmount('10'));
    await act(() => result.current.submit());

    const rows = rowsFor(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: -1,
      amount: 1000,
      account: 'cash',
      refKind: 'supplier',
      refId: supplier.id,
      occurredAt: T0,
      docId: null, // a سداد payment is born of no document, and survives any deletion
    });
    expect(mockRepos.debts.owed(supplier.id)).toBe(1520);
  });

  it('confirms with the RIGHT NUMBERS — what was paid, and what is still owed', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAmount('10'));
    await act(() => result.current.submit());

    expect(lastAlert()?.title).toBe(i18n.t('payments.saved.title'));
    expect(lastAlert()?.message).toBe(
      i18n.t('payments.saved.withRemaining', {
        paid: '١٠٫٠٠ ج.م',
        name: 'أحمد',
        remaining: '١٥٫٢٠ ج.م',
      }),
    );

    // The sheet closes only when he taps OK — that is when the screen reloads.
    expect(onSaved).not.toHaveBeenCalled();
    pressAlertButton(i18n.t('documents.ok'));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('says "cleared" — never a negative remainder — when the debt is fully settled', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAmount('25.20'));
    await act(() => result.current.submit());

    expect(lastAlert()?.message).toBe(
      i18n.t('payments.saved.cleared', { paid: '٢٥٫٢٠ ج.م', name: 'أحمد' }),
    );
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
  });
});

describe('useSettlePayment — over-paying is ALLOWED, and becomes a credit', () => {
  it('accepts more than is owed: the row is written in full, unclamped', async () => {
    const supplier = owingSupplier(); // owed 2520
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAmount('40')); // 4000 against 2520 owed
    expect(result.current.canSave).toBe(true);

    await act(() => result.current.submit());

    const rows = rowsFor(supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(4000); // NOT trimmed to 2520 — his money, all of it
    // Debt goes NEGATIVE: that is a credit (رصيد لك), the truth of the situation.
    expect(mockRepos.debts.owed(supplier.id)).toBe(-1480);
  });

  it('does not error, and reads as CLEARED rather than a negative remainder', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAmount('40'));
    await act(() => result.current.submit());

    expect(lastAlert()?.title).toBe(i18n.t('payments.saved.title'));
    expect(lastAlert()?.title).not.toBe(i18n.t('payments.errors.title'));
    expect(lastAlert()?.message).toBe(
      i18n.t('payments.saved.cleared', { paid: '٤٠٫٠٠ ج.م', name: 'أحمد' }),
    );
  });
});

describe('useSettlePayment — «دفعة قديمة» (the opening adjustment)', () => {
  it('writes ref_kind "opening", and keeps the row OUT of the cash book', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setOpening(true));
    await act(() => result.current.setAmount('25.20'));
    await act(() => result.current.submit());

    const rows = mockRepos.transactions.listByRef('opening', supplier.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refKind: 'opening', direction: -1, amount: 2520 });
    expect(mockRepos.transactions.listByRef('supplier', supplier.id)).toHaveLength(0);

    // IT PAYS THE DEBT DOWN…
    expect(mockRepos.debts.owed(supplier.id)).toBe(0);
    // …AND IT NEVER TOUCHES THE DRAWER. Money that left six months ago must not
    // empty a till that is sitting full on the counter.
    expect(mockRepos.transactions.balances()).toMatchObject({
      cash: 0,
      instapay: 0,
      total: 0,
    });
    expect(mockRepos.transactions.listForCashBook()).toHaveLength(0);
  });

  it('forces the account back to cash — an opening row reaches no pocket', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setAccount('instapay'));
    expect(result.current.draft.account).toBe('instapay');

    await act(() => result.current.setOpening(true));
    expect(result.current.draft.account).toBe('cash');
    expect(result.current.draft.proof).toEqual([]);
  });

  it('turned OFF again, it is an ordinary payment: ref_kind "supplier", in the cash book', async () => {
    const supplier = owingSupplier();
    const { result } = await setup(supplier.id, 2520);

    await act(() => result.current.setOpening(true));
    await act(() => result.current.setOpening(false));
    await act(() => result.current.setAmount('25.20'));
    await act(() => result.current.submit());

    expect(mockRepos.transactions.listByRef('opening', supplier.id)).toHaveLength(0);
    expect(rowsFor(supplier.id)).toHaveLength(1);
    expect(mockRepos.transactions.balances().cash).toBe(-2520); // the drawer really did empty
  });
});
