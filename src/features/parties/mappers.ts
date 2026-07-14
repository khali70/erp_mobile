import type { Customer, Supplier } from '@/db/schema';
import type { Party } from './types';

/**
 * Map a customer/supplier row to the shared UI party shape.
 *
 * `balanceMinor` is passed IN, derived, by the caller — it is deliberately NOT
 * read off `row.balance`, which is a retired column that nothing writes. Debt is
 * derived from documents − transactions; see debt-repository.
 */
export function toParty(row: Customer | Supplier, balanceMinor: number): Party {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    balanceMinor,
  };
}
