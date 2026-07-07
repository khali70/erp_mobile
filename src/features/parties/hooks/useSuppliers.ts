import { useCallback, useEffect, useState } from 'react';
import { supplierRepository } from '@/repositories/supplier-repository';
import type { Party } from '../types';
import { toParty } from '../mappers';

/**
 * Loads suppliers from the repository (source of truth = SQLite).
 * Returns the list plus a `reload` to re-query after mutations.
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Party[]>([]);

  const reload = useCallback(() => {
    setSuppliers(supplierRepository.list().map(toParty));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { suppliers, reload };
}
