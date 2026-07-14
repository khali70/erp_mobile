import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { expenseRepository } from '@/repositories/expense-repository.client';
import type { ExpenseCategory, ExpenseDebt } from '@/repositories/expense-repository';
import { shiftMonth, startOfMonth } from '@/utils/dates';

export type ExpenseFilter = 'all' | ExpenseCategory;

/**
 * The expenses list, its filter, and the month's figures.
 *
 * Every number here is READ from the repository, and the two money figures are
 * different questions that must not be fused:
 *   • `monthTotal`  — what the month COST (Σ of the expenses incurred in it),
 *                     whether or not they have been paid.
 *   • `unpaidTotal` — what is STILL OWED on the expenses on screen. This is the
 *                     slice of the Home payables KPI that used to be missing.
 * A rent bill that is fully paid still cost the shop 20,000; it just is not debt.
 *
 * Re-reads on FOCUS, because the answer changes behind the screen's back — the
 * سداد sheet writes a transaction, and a stale list would keep showing a bill the
 * owner just settled as if he still owed it.
 */
interface ExpensesState {
  all: ExpenseDebt[];
  /** What the month COST — Σ incurred, paid or not. */
  monthTotal: number;
  lastMonthTotal: number;
  /** What is STILL OWED on them. Positive remainders only. */
  unpaidTotal: number;
}

const EMPTY: ExpensesState = { all: [], monthTotal: 0, lastMonthTotal: 0, unpaidTotal: 0 };

export function useExpenses() {
  const [state, setState] = useState<ExpensesState>(EMPTY);

  const [filter, setFilter] = useState<ExpenseFilter>('all');

  const reload = useCallback(() => {
    const all = expenseRepository.listWithDebt();

    // Bucketed in the shop's LOCAL timezone (Egypt), never UTC — a bill entered
    // just after midnight would otherwise fall into the previous month.
    const thisMonth = startOfMonth(Date.now());
    const nextMonth = shiftMonth(thisMonth, 1);
    const prevMonth = shiftMonth(thisMonth, -1);

    setState({
      all,
      monthTotal: expenseRepository.totalIncurredBetween(thisMonth, nextMonth),
      lastMonthTotal: expenseRepository.totalIncurredBetween(prevMonth, thisMonth),
      // Only POSITIVE remainders: an over-paid bill is a receivable, and letting
      // it net against the others would understate what is still to be paid.
      unpaidTotal: all.reduce((sum, e) => (e.remaining > 0 ? sum + e.remaining : sum), 0),
    });
  }, []);

  useFocusEffect(reload);

  const visible = useMemo(
    () => (filter === 'all' ? state.all : state.all.filter((e) => e.category === filter)),
    [state.all, filter],
  );

  return {
    expenses: visible,
    /**
  * the selected category filter, or 'all' for no filter. The list is filtered in memory, not in the repository.
  */
    filter,
    setFilter,
    monthTotal: state.monthTotal,
    lastMonthTotal: state.lastMonthTotal,
    unpaidTotal: state.unpaidTotal,
    reload,
  };
}
