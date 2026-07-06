import type { Customer, Supplier } from '@/db/schema';
import type { Party } from './types';

/** Map a customer/supplier row to the shared UI party shape. */
export function toParty(row: Customer | Supplier): Party {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    balanceMinor: row.balance,
  };
}
