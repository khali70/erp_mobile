import { useCallback, useMemo, useState } from 'react';
import type { InventoryItem, StockFilter } from '../types';
import {
  EMPTY_ADVANCED_FILTERS,
  countActiveFilters,
  filterItems,
  type AdvancedItemFilters,
} from '../utils/filterItems';

/**
 * Owns search + stock chip + the advanced filter set, and derives the visible
 * list from them. All predicate logic lives in `utils/filterItems` (pure and
 * unit-tested); this hook is only the state that feeds it, so the screen stays
 * composition-only.
 */
export function useItemFilter(items: InventoryItem[]) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [advanced, setAdvanced] = useState<AdvancedItemFilters>(EMPTY_ADVANCED_FILTERS);

  const filtered = useMemo(
    () => filterItems(items, { query, stock: filter, advanced }),
    [items, query, filter, advanced],
  );

  const activeAdvancedCount = useMemo(() => countActiveFilters(advanced), [advanced]);

  /** Any filter at all is on — search, stock chip, or an advanced dimension. */
  const anyFilterActive = query.trim() !== '' || filter !== 'all' || activeAdvancedCount > 0;

  const resetAdvanced = useCallback(() => setAdvanced(EMPTY_ADVANCED_FILTERS), []);

  const reset = useCallback(() => {
    setQuery('');
    setFilter('all');
    setAdvanced(EMPTY_ADVANCED_FILTERS);
  }, []);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    advanced,
    setAdvanced,
    activeAdvancedCount,
    anyFilterActive,
    filtered,
    reset,
    resetAdvanced,
  };
}
