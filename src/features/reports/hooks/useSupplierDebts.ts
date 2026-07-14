import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { SupplierDebt } from '@/repositories/debt-repository';
import type { ExpenseDebt } from '@/repositories/expense-repository';

interface DebtsState {
  suppliers: SupplierDebt[];
  expenses: ExpenseDebt[];
  payables: { suppliers: number; expenses: number; total: number };
  /** True until the first read RETURNS. The screen starts empty, and an empty
   *  debts screen says "you owe nobody 🎉" — which must never be shown as a
   *  guess, only as an answer. */
  loading: boolean;
  /** A repository throw is a red box today. Here it becomes a state. */
  error: boolean;
}

const EMPTY: DebtsState = {
  suppliers: [],
  expenses: [],
  payables: { suppliers: 0, expenses: 0, total: 0 },
  loading: true,
  error: false,
};

/**
 * EVERYTHING THE SHOP OWES — suppliers AND unpaid bills.
 *
 * The screen is titled "ديون الموردين", but the owner's actual question is "what
 * do I owe", and suppliers are only one slice of the answer: rent is debt too.
 * So the hook reads both books and hands back the same `payables()` breakdown the
 * Home KPI uses — one authority, so the two screens can never disagree.
 *
 * The repository does all the deriving (posted invoices − payments, FIFO-walked
 * for the aging; total − payments for a bill). This hook only decides WHEN to
 * ask: on FOCUS, because the answer changes behind the screen's back — paying
 * Ahmed on his detail screen must not leave him sitting in a stale list on the
 * way back.
 */
export function useSupplierDebts() {
  const [state, setState] = useState<DebtsState>(EMPTY);

  const reload = useCallback(() => {
    try {
      setState({
        suppliers: debtRepository.list(),
        expenses: debtRepository.unpaidExpenses(),
        payables: debtRepository.payables(),
        loading: false,
        error: false,
      });
    } catch {
      setState({ ...EMPTY, loading: false, error: true });
    }
  }, []);

  useFocusEffect(reload);

  return {
    debts: state.suppliers,
    unpaidExpenses: state.expenses,
    /** Σ of the supplier rows below — positive debts only, no credits netted in. */
    totalOwed: state.payables.suppliers,
    expensesOwed: state.payables.expenses,
    /** Suppliers + bills. The same figure the Home payables KPI shows. */
    totalPayables: state.payables.total,
    loading: state.loading,
    error: state.error,
    /**
     * True only when the shop owes NOBODY — supplier or landlord — AND we have
     * actually looked. Before the first read there is no answer, only an empty
     * state object, and "لا توجد ديون 🎉" must not be rendered from that.
     */
    isEmpty:
      !state.loading &&
      !state.error &&
      state.suppliers.length === 0 &&
      state.expenses.length === 0,
    reload,
  };
}
