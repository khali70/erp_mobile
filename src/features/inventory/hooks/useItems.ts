import { useCallback, useEffect, useState } from 'react';
import { itemRepository } from '@/repositories/item-repository.client';
import type { InventoryItem } from '../types';
import { toInventoryItem } from '../mappers';

/**
 * Loads inventory items from the repository (source of truth = SQLite).
 * Returns the list plus a `reload` to re-query after mutations.
 */
export function useItems() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const reload = useCallback(() => {
    setItems(itemRepository.listWithStock().map(toInventoryItem));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, reload };
}
