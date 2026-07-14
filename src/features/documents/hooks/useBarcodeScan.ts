import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { playScanBeep } from '@/utils/scan-sound';
import type { InventoryItem } from '@/features/inventory/types';
import type { ScanAppendResult } from '../types';

// Same physical scan fires the camera callback many times/sec. Ignore a repeat
// of the *same* code within this window so one barcode never adds N rows; a
// different code is always accepted instantly.
const COOLDOWN_MS = 1500;

export type ScanFeedback =
  | { kind: 'hit'; name: string; qty: number }
  | { kind: 'miss'; code: string }
  // The catalog KNOWS this barcode — the shop just has none of it left (or the
  // invoice has already claimed all of it). A scan that quietly did nothing would
  // be indistinguishable from a scan that worked, and he is not watching the list.
  | { kind: 'blocked'; name: string; available: number }
  | null;

interface Options {
  items: InventoryItem[];
  /** Add/bump the scanned item, or refuse it when there is no stock behind it. */
  onHit: (item: InventoryItem) => ScanAppendResult;
}

/**
 * Barcode decode → catalog lookup → append. UI-agnostic so a hardware HID
 * scanner (keystroke stream) can later feed the same `handleScan(code)`.
 */
export function useBarcodeScan({ items, onHit }: Options) {
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const lastSeen = useRef<Record<string, number>>({});

  const handleScan = 
    (code: string) => {
      const now = Date.now();
      const prev = lastSeen.current[code];
      if (prev && now - prev < COOLDOWN_MS) return; // same code, still cooling down
      lastSeen.current[code] = now;

      playScanBeep();
      const item = items.find((i) => i.barcode === code);
      if (item) {
        const result = onHit(item);
        if (!result.ok) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setFeedback({ kind: 'blocked', name: result.name, available: result.available });
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFeedback({ kind: 'hit', name: item.name, qty: result.qty });
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setFeedback({ kind: 'miss', code });
      }
    }


  const clearFeedback = useCallback(() => setFeedback(null), []);

  return { feedback, handleScan, clearFeedback };
}
