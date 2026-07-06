import { useCallback, useEffect, useState } from 'react';
import { documentRepository } from '@/repositories/document-repository.client';
import type { MovementEntry } from '@/repositories/document-repository';

/**
 * Posted stock movement for one item (source of truth = SQLite ledger).
 * Returns entries oldest-first with a cumulative running balance, plus the
 * current on-hand (== last entry's runningBalance) and a `reload`.
 */
export function useItemMovement(itemId: string) {
  const [entries, setEntries] = useState<MovementEntry[]>([]);
  const [onHand, setOnHand] = useState(0);

  const reload = useCallback(() => {
    setEntries(documentRepository.movement(itemId));
    setOnHand(documentRepository.onHand(itemId));
  }, [itemId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { entries, onHand, reload };
}
