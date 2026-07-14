import { useCallback, useEffect, useState } from 'react';
import { customerRepository } from '@/repositories/customer-repository.client';
import { supplierRepository } from '@/repositories/supplier-repository.client';
import { debtRepository } from '@/repositories/debt-repository.client';
import { fromMinor } from '@/utils/money';
import type { Customer, Supplier } from '@/db/schema';
import type { DocMode, Party } from '../types';

/**
 * Map a customer/supplier row to the document-form party shape.
 *
 * `debt` is the DERIVED figure (posted purchase invoices − payments), never the
 * retired `balance` column — which was set to 0 at creation and never written
 * again, so every consumer of it rendered a permanent zero. This is what finally
 * makes PartyCard's "مديونية سابقة للمورد علينا" line render.
 */
function toDocParty(row: Customer | Supplier, debtMinor: number): Party {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    debt: fromMinor(debtMinor),
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
    if (mode === 'sale') {
      // Customer debt (AR) is deprecated and unbuilt — a sale is settled in full,
      // so a customer carries no balance to show.
      setParties(customerRepository.list().map((row) => toDocParty(row, 0)));
      return;
    }
    const owed = debtRepository.owedBySupplier();
    setParties(supplierRepository.list().map((row) => toDocParty(row, owed.get(row.id) ?? 0)));
  }, [mode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    (input: { name: string; phone?: string | null }): Party => {
      const row =
        mode === 'sale' ? customerRepository.create(input) : supplierRepository.create(input);
      reload();
      return toDocParty(row, 0); // brand new — nothing owed to them yet
    },
    [mode, reload],
  );

  return { parties, reload, create };
}
