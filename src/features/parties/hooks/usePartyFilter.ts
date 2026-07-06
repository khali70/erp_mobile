import { useMemo, useState } from 'react';
import type { Party } from '../types';

export type PartyFilter = 'all' | 'withDebt';

/**
 * Encapsulates search (name or phone) + debt-filter state over a party list.
 * Keeps filtering logic out of the view (single responsibility).
 */
export function usePartyFilter(parties: Party[]) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PartyFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim();
    return parties.filter((party) => {
      const matchesSearch =
        q === '' || party.name.includes(q) || (party.phone ?? '').includes(q);
      if (!matchesSearch) return false;
      if (filter === 'withDebt') return party.balanceMinor > 0;
      return true;
    });
  }, [parties, query, filter]);

  const reset = () => {
    setQuery('');
    setFilter('all');
  };

  return { query, setQuery, filter, setFilter, filtered, reset };
}
