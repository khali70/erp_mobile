import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { SupplierDebt } from '@/repositories/debt-repository';

/**
 * The debts-by-supplier list: every supplier the shop owes, WORST FIRST.
 *
 * The repository does the deriving (posted invoices − payments, FIFO-walked for
 * the aging); this hook only decides WHEN to ask. It re-reads on focus because
 * the answer changes behind the screen's back — paying Ahmed on his detail
 * screen must not leave him sitting in a stale list on the way back.
 */
export function useSupplierDebts() {
  const [debts, setDebts] = useState<SupplierDebt[]>([]);

  const reload = useCallback(() => {
    setDebts(debtRepository.list());
  }, []);

  useFocusEffect(reload);

  const totalOwed = debts.reduce((sum, d) => sum + d.owed, 0);

  return { debts, totalOwed, reload };
}
