import { useCallback, useEffect, useState } from 'react';
import { customerRepository } from '@/repositories/customer-repository';
import type { Party } from '../types';
import { toParty } from '../mappers';

/**
 * Loads customers from the repository (source of truth = SQLite).
 * Returns the list plus a `reload` to re-query after mutations.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState<Party[]>([]);

  const reload = useCallback(() => {
    setCustomers(customerRepository.list().map(toParty));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { customers, reload };
}
