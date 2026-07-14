import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { debtRepository } from '@/repositories/debt-repository.client';
import type { InvoiceSettlement } from '@/repositories/debt-repository';

/**
 * "DID I PAY THIS INVOICE?" — asked of ONE document.
 *
 * The owner taps IN-000012 to check whether he has paid it, and until now the
 * detail screen did not mention money AT ALL: the only place the answer existed
 * was the debts report, three screens away and organised by supplier rather than
 * by the invoice in his hand.
 *
 * The answer is DERIVED, never stored — there is no `paid_amount` column and
 * there must never be one. It comes from the same FIFO walk the debts screen
 * reads (`debtRepository.settlements`), which is the whole point: the two screens
 * cannot disagree, because they are the same subtraction. Re-deriving it here is
 * cheaper than a cached flag that can drift, and drift is the only failure mode
 * that matters with money.
 *
 * Null when the question does not apply:
 *  • a SALE — sales are settled in full at the counter; there is no debt to owe.
 *  • a WALK-IN purchase — the sentinel supplier walks nothing (its debt is defined
 *    as 0), and a cash purchase was paid in full or it never happened.
 *  • a DRAFT — `settlements()` only walks posted invoices; a draft is not an
 *    obligation and this document will simply not be among them.
 *
 * Re-reads on FOCUS: paying this supplier on his debt screen changes the answer
 * behind this screen's back.
 */
export function useDocumentSettlement(
  documentId: string,
  kind: 'in' | 'out' | null,
  supplierId: string | null,
) {
  const [settlement, setSettlement] = useState<InvoiceSettlement | null>(null);

  const reload = useCallback(() => {
    if (kind !== 'in' || !supplierId) {
      setSettlement(null);
      return;
    }
    try {
      const walked = debtRepository.settlements(supplierId);
      setSettlement(walked.find((s) => s.documentId === documentId) ?? null);
    } catch {
      // A throw is not an answer. Showing NOTHING is honest here; showing
      // "unpaid" would be a guess about money.
      setSettlement(null);
    }
  }, [documentId, kind, supplierId]);

  useFocusEffect(reload);

  return { settlement };
}
