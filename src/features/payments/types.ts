import type { AttachmentMeta } from '@/repositories/document-repository';
import type { Account, TxRefKind } from '@/repositories/transaction-repository';

/**
 * WHAT a payment is being made against — the whole reason the سداد sheet is
 * reusable rather than a supplier screen with a form glued to it.
 *
 * A payment points at a REF, never at an invoice. Paying Ahmed is
 * `{ refKind: 'supplier', refId: ahmed }`; paying the rent (Epic 3) is
 * `{ refKind: 'expense', refId: rent }` — the same sheet, the same single
 * cash-book row, nothing about the sheet hardcoded to suppliers.
 */
export interface SettleTarget {
  refKind: TxRefKind;
  refId: string;
}

/** The sheet's working state. `amount` is as TYPED (major units) until save. */
export interface SettleDraft {
  amount: string;
  account: Account;
  /** When the money MOVED — defaults to today, and often is not the invoice date. */
  occurredAt: number;
  note: string;
  /** PROOF OF MONEY. Only ever collected for InstaPay — cash has nothing to show. */
  proof: AttachmentMeta[];
}
