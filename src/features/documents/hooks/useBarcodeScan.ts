import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { InventoryItem } from '@/features/inventory/types';

// Same physical scan fires the camera callback many times/sec. Ignore a repeat
// of the *same* code within this window so one barcode never adds N rows; a
// different code is always accepted instantly.
const COOLDOWN_MS = 1500;

export type ScanFeedback =
  | { kind: 'hit'; name: string; qty: number }
  | { kind: 'miss'; code: string }
  | null;

interface Options {
  items: InventoryItem[];
  /** Add/bump the scanned item; returns the resulting line qty for feedback. */
  onHit: (item: InventoryItem) => number;
}

/**
 * Barcode decode → catalog lookup → append. UI-agnostic so a hardware HID
 * scanner (keystroke stream) can later feed the same `handleScan(code)`.
 */
export function useBarcodeScan({ items, onHit }: Options) {
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const lastSeen = useRef<Record<string, number>>({});

  const handleScan = useCallback(
    (code: string) => {
      const now = Date.now();
      const prev = lastSeen.current[code];
      if (prev && now - prev < COOLDOWN_MS) return; // same code, still cooling down
      lastSeen.current[code] = now;

      const item = items.find((i) => i.barcode === code);
      if (item) {
        const qty = onHit(item);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedback({ kind: 'hit', name: item.name, qty });
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setFeedback({ kind: 'miss', code });
      }
    },
    [items, onHit],
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return { feedback, handleScan, clearFeedback };
}
