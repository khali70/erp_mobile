import { useCallback, useEffect, useState } from 'react';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { SupplierDebtDetail } from '@/repositories/debt-repository';

const EMPTY: SupplierDebtDetail = { owed: 0, invoices: [], payments: [], credit: 0 };

/**
 * One supplier's whole book: his invoices with the DERIVED settlement breakdown,
 * and the payments that produced it.
 *
 * `reload` is what a new payment calls. Nothing is cached and nothing is stored,
 * so the breakdown after a payment is not "updated" — it is simply re-derived,
 * and it cannot drift from the invoices, because it IS the invoices.
 */
export function useSupplierDebtDetail(supplierId: string) {
  const [detail, setDetail] = useState<SupplierDebtDetail>(EMPTY);

  const reload = useCallback(() => {
    setDetail(debtRepository.detail(supplierId));
  }, [supplierId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { detail, reload };
}
