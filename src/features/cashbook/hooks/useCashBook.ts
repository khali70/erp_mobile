import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { transactionRepository } from '@/repositories/transaction-repository.client';
import type { AccountTotals } from '@/repositories/transaction-repository';
import { endOfDay, startOfDay } from '@/utils/dates';
import { toLedgerDays } from '../ledger';
import type { LedgerDay } from '../types';

interface CashBookState {
  days: LedgerDay[];
  /** What is IN each pocket right now — derived, never stored. */
  balances: AccountTotals;
  /** What the shop SOLD today, split by the pocket it landed in. */
  salesToday: AccountTotals;
  /** True until the first read RETURNS — an empty cash book is an ANSWER, and
   *  it must not be drawn before the question has been asked. */
  loading: boolean;
  /** A repository throw is a red box today. Here it becomes a state. */
  error: boolean;
}

const ZERO: AccountTotals = { cash: 0, instapay: 0, total: 0 };
const EMPTY: CashBookState = {
  days: [],
  balances: ZERO,
  salesToday: ZERO,
  loading: true,
  error: false,
};

/**
 * THE CASH BOOK — every movement of money, and what each pocket holds.
 *
 * Every figure is DERIVED from the `transactions` rows on every read. Nothing is
 * cached and no balance is stored, so no figure here can disagree with the
 * ledger below it — it IS the ledger. That is the whole basis for trusting it:
 * the owner counts the drawer, compares, and the two match or the app is wrong
 * in a way he can see.
 *
 * `salesToday` comes from the TRANSACTIONS, filtered on `occurred_at` and
 * `ref_kind='sale'` — never from `documents`, which has no `account` column and
 * cannot say which pocket a sale landed in (and for a split-paid sale, the
 * answer is "both").
 *
 * Re-reads on FOCUS: a sale posted on another screen, or a payment made from the
 * debts screen, changes these numbers behind the cash book's back.
 */
export function useCashBook() {
  const [state, setState] = useState<CashBookState>(EMPTY);

  const reload = useCallback(() => {
    const now = Date.now();
    try {
      setState({
        days: toLedgerDays(transactionRepository.listForCashBook()),
        balances: transactionRepository.balances(),
        // Half-open [startOfDay, startOfTomorrow) in the shop's LOCAL timezone.
        salesToday: transactionRepository.salesBetween(startOfDay(now), endOfDay(now)),
        loading: false,
        error: false,
      });
    } catch {
      setState({ ...EMPTY, loading: false, error: true });
    }
  }, []);

  useFocusEffect(reload);

  return {
    days: state.days,
    balances: state.balances,
    salesToday: state.salesToday,
    loading: state.loading,
    error: state.error,
    isEmpty: !state.loading && !state.error && state.days.length === 0,
    reload,
  };
}
