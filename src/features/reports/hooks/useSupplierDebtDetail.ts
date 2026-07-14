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
 *
 * `loading` is true until the first read RETURNS: the state starts EMPTY, and an
 * empty book renders a balance of ٠ and "لا توجد فواتير" — an answer, drawn a
 * frame before the question was asked. `error` turns a repository throw into a
 * state the screen can show instead of a red box.
 */
export function useSupplierDebtDetail(supplierId: string) {
  const [detail, setDetail] = useState<SupplierDebtDetail>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    try {
      setDetail(debtRepository.detail(supplierId));
      setError(false);
    } catch {
      setDetail(EMPTY);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { detail, loading, error, reload };
}
