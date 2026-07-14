import type { TFunction } from 'i18next';
import type { Party } from './types';
import { toArabicDigits } from '@/utils/numerals';
import { fromMinor } from '@/utils/money';

/** Fully-resolved, display-ready shape consumed by <PartyRow>. */
export interface PartyViewModel {
  id: string;
  name: string;
  initial: string;
  phoneLabel: string;
  debtLabel: string;
  hasDebt: boolean;
}

/**
 * Map a party to its display view-model (initial, phone, debt label).
 *
 * Three states, not two. A NEGATIVE balance is a CREDIT — you paid the supplier
 * more than you owed him, so he owes you (رصيد لك). It is a legitimate outcome
 * of an over-payment, never an error, and it must not be flattened into
 * "settled" as if the books were level.
 */
export function presentParty(party: Party, t: TFunction): PartyViewModel {
  const hasDebt = party.balanceMinor > 0;
  const isCredit = party.balanceMinor < 0;
  const amount = toArabicDigits(Math.abs(fromMinor(party.balanceMinor)));

  const debtLabel = hasDebt
    ? `${amount} ${t('common.currency')}`
    : isCredit
      ? `${t('debts.credit')}: ${amount} ${t('common.currency')}`
      : t('parties.settled');

  return {
    id: party.id,
    name: party.name,
    initial: party.name.trim().charAt(0),
    phoneLabel: party.phone ?? t('parties.noPhone'),
    debtLabel,
    hasDebt,
  };
}
