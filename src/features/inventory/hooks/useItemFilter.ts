import { useMemo, useState } from 'react';
import type { InventoryItem, StockFilter } from '../types';
import { getStockStatus } from '@/utils/stock';

/**
 * Encapsulates search + stock-filter state and derivation over a list of items.
 * Keeps filtering logic out of the view (single responsibility).
 */
export function useItemFilter(items: InventoryItem[]) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim();
    return items.filter((item) => {
      const matchesSearch = q === '' || item.name.includes(q);
      if (!matchesSearch) return false;

      const status = getStockStatus(item.qty, item.lowStockThreshold);
      if (filter === 'low') return status === 'low';
      if (filter === 'out') return status === 'out';
      return true;
    });
  }, [items, query, filter]);

  const reset = () => {
    setQuery('');
    setFilter('all');
  };

  return { query, setQuery, filter, setFilter, filtered, reset };
}
