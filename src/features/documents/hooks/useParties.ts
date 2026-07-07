import { useCallback, useEffect, useState } from 'react';
import { customerRepository } from '@/repositories/customer-repository';
import { supplierRepository } from '@/repositories/supplier-repository';
import { fromMinor } from '@/utils/money';
import type { Customer, Supplier } from '@/db/schema';
import type { DocMode, Party } from '../types';

/** Map a customer/supplier row to the document-form party shape (whole-unit debt). */
function toDocParty(row: Customer | Supplier): Party {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    debt: fromMinor(row.balance),
  };
}

/**
 * Loads the document's counterparties from SQLite — customers for a sale,
 * suppliers for a purchase (source of truth = the same tables the parties
 * feature edits). `create` persists a quick-added party and returns it mapped,
 * ready to select immediately.
 */
export function useParties(mode: DocMode) {
  const [parties, setParties] = useState<Party[]>([]);

  const reload = useCallback(() => {
    const rows = mode === 'sale' ? customerRepository.list() : supplierRepository.list();
    setParties(rows.map(toDocParty));
  }, [mode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    (input: { name: string; phone?: string | null }): Party => {
      const row =
        mode === 'sale' ? customerRepository.create(input) : supplierRepository.create(input);
      reload();
      return toDocParty(row);
    },
    [mode, reload],
  );

  return { parties, reload, create };
}
