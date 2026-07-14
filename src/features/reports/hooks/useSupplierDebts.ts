import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { SupplierDebt } from '@/repositories/debt-repository';
import type { ExpenseDebt } from '@/repositories/expense-repository';

interface DebtsState {
  suppliers: SupplierDebt[];
  expenses: ExpenseDebt[];
  payables: { suppliers: number; expenses: number; total: number };
}

const EMPTY: DebtsState = {
  suppliers: [],
  expenses: [],
  payables: { suppliers: 0, expenses: 0, total: 0 },
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
    setState({
      suppliers: debtRepository.list(),
      expenses: debtRepository.unpaidExpenses(),
      payables: debtRepository.payables(),
    });
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
    /** True only when the shop owes NOBODY — supplier or landlord. */
    isEmpty: state.suppliers.length === 0 && state.expenses.length === 0,
    reload,
  };
}
