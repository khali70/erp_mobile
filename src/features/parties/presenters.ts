import type { TFunction } from 'i18next';
import type { Party } from './types';
import { toArabicDigits } from '@/utils/numerals';

/** Fully-resolved, display-ready shape consumed by <PartyRow>. */
export interface PartyViewModel {
  id: string;
  name: string;
  initial: string;
  phoneLabel: string;
  debtLabel: string;
  hasDebt: boolean;
}

/** Map a party to its display view-model (initial, phone, debt label). */
export function presentParty(party: Party, t: TFunction): PartyViewModel {
  const hasDebt = party.balanceMinor > 0;
  const amount = toArabicDigits(Math.round(party.balanceMinor / 100));
  return {
    id: party.id,
    name: party.name,
    initial: party.name.trim().charAt(0),
    phoneLabel: party.phone ?? t('parties.noPhone'),
    debtLabel: hasDebt ? `${amount} ${t('common.currency')}` : t('parties.settled'),
    hasDebt,
  };
}
