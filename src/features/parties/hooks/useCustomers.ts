import { useCallback, useEffect, useState } from 'react';
import { customerRepository } from '@/repositories/customer-repository.client';
import type { Party } from '../types';
import { toParty } from '../mappers';

/**
 * Loads customers from the repository (source of truth = SQLite).
 * Returns the list plus a `reload` to re-query after mutations.
 *
 * Customers carry NO balance: customer debt (AR) is deprecated and unbuilt — a
 * sale is settled in full, so there is no book for one to be owed against. AP
 * and AR are separate books and are never auto-netted, even for a party who is
 * both supplier and customer.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState<Party[]>([]);

  const reload = useCallback(() => {
    setCustomers(customerRepository.list().map((row) => toParty(row, 0)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { customers, reload };
}
