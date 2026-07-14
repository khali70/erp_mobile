/**
 * THE EXPENSE AMOUNT BOX — the one an Arabic keypad could not type into.
 *
 * `setAmount` used to be `v.replace(/[^0-9.]/g, '')`. The shop owner types on an
 * Arabic keypad. Every ٠-٩ he pressed matched `[^0-9.]` and was deleted before it
 * reached the draft, so the box stayed empty no matter how long he typed, the
 * save button never lit, and the rent could not be recorded at all. The bug was
 * invisible to every test that typed '1000' — which is every test written by
 * someone using a Latin keyboard.
 *
 * The repositories are REAL, over an in-memory better-sqlite3 db, so an amount
 * that parses to zero is rejected by the actual SQL CHECK, not by a mock that
 * agrees with whatever it is handed.
 */
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@/i18n';
import { repos as mockRepos } from '@/testing/hook-repos';
import { alertCount, lastAlert } from '@/testing/alerts';
import { useExpenseForm } from './useExpenseForm';

jest.mock('@/repositories/expense-repository.client', () => ({
  get expenseRepository() {
    return mockRepos.expenses;
  },
}));

const onSaved = jest.fn();

const setup = () => renderHook(() => useExpenseForm({ visible: true, onSaved }));

const rows = () => mockRepos.expenses.list();

/** Fill the title so the ONLY thing under test is the amount. */
const withTitle = async (result: { current: ReturnType<typeof useExpenseForm> }) => {
  await act(() => result.current.setTitle('إيجار المحل'));
};

describe('useExpenseForm — the amount box speaks Arabic', () => {
  it('accepts ARABIC-INDIC digits: ١٠٠٠ is one thousand pounds, not an empty box', async () => {
    const { result } = await setup();
    await withTitle(result);

    await act(() => result.current.setAmount('١٠٠٠'));

    // The draft keeps what he typed (normalized), and the save button LIGHTS.
    expect(result.current.draft.amount).toBe('1000');
    expect(result.current.canSave).toBe(true);

    await act(() => result.current.submit());

    expect(rows()).toHaveLength(1);
    // 1000 pounds → 100000 piasters. Integer minor units, crossed exactly once.
    expect(rows()[0].totalAmount).toBe(100_000);
  });

  it('accepts the Arabic decimal separator: ١٢٫٥٠ is twelve and a half', async () => {
    const { result } = await setup();
    await withTitle(result);

    await act(() => result.current.setAmount('١٢٫٥٠'));
    await act(() => result.current.submit());

    expect(rows()[0].totalAmount).toBe(1250);
  });

  it('strips the thousands separator the app ITSELF prints: ١٬٠٠٠ is not one pound', async () => {
    const { result } = await setup();
    await withTitle(result);

    // This is what formatMoneyMajor renders. A man who copies a figure out of the
    // app and pastes it back in must not be charged 1 pound for a 1000 pound bill.
    await act(() => result.current.setAmount('١٬٠٠٠'));
    await act(() => result.current.submit());

    expect(rows()[0].totalAmount).toBe(100_000);
  });

  it('still refuses garbage: no row, and a LOCALIZED refusal', async () => {
    const { result } = await setup();
    await withTitle(result);

    await act(() => result.current.setAmount('ابجد'));
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.submit());

    expect(rows()).toHaveLength(0);
    expect(alertCount()).toBe(1);
    expect(lastAlert()?.message).toBe(i18n.t('expenses.errors.amountRequired'));
    expect(lastAlert()?.message).not.toBe('expenses.errors.amountRequired');
  });

  it('still refuses ZERO — a CHECK constraint, not a mock agreeing with us', async () => {
    const { result } = await setup();
    await withTitle(result);

    await act(() => result.current.setAmount('٠'));
    await act(() => result.current.submit());

    expect(rows()).toHaveLength(0);
    expect(alertCount()).toBe(1);
  });
});
