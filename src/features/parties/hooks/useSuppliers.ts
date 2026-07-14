import { useCallback, useEffect, useState } from 'react';
import { supplierRepository } from '@/repositories/supplier-repository.client';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { Party } from '../types';
import { toParty } from '../mappers';

/**
 * Loads suppliers from the repository (source of truth = SQLite), each carrying
 * its DERIVED debt — posted purchase invoices minus payments.
 *
 * This is what finally lights up `DebtBadge` and the `withDebt` filter chip.
 * Both have been coded all along and had never once rendered a non-zero value,
 * because they read `suppliers.balance`: a column set to 0 at creation that
 * nothing ever wrote again. The number is now the invoices themselves, so it
 * cannot disagree with them.
 *
 * One `owedBySupplier()` call for the whole list — N suppliers, not N queries.
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Party[]>([]);

  const reload = useCallback(() => {
    const owed = debtRepository.owedBySupplier();
    setSuppliers(supplierRepository.list().map((row) => toParty(row, owed.get(row.id) ?? 0)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { suppliers, reload };
}
