import { useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import type { NegativeStockViolation } from '@/features/inventory/posting';
import type { InventoryItem } from '@/features/inventory/types';
import type { DocLine, DocMode } from '../types';
import {
  headroomForItem,
  lineViolations,
  maxQtyForLine,
  onHandOf,
  type OnHand,
} from '../utils/stock-ceilings';

/**
 * What the form knows about stock, projected onto the document being built.
 * Consumed by `useDocumentForm` (clamping) and by the picker / row / scanner
 * (what to disable, what to say).
 */
export interface DocStock {
  /**
   * THE SOLE GATE. Every restriction below is a no-op when this is false —
   * which it is for a PURCHASE (incoming stock has no ceiling) and whenever the
   * owner has turned `allowNegativeStock` on.
   */
  enforced: boolean;
  /** On-hand as the form knows it (may be stale — the repository is authoritative). */
  onHand: OnHand;
  /** Qty ceiling per LINE id; `null` = unbounded (unenforced, or a fast-entry line). */
  maxQtyById: Record<string, number | null>;
  /** Units of an item this document can still take. `Infinity` when unenforced. */
  headroomFor: (itemId: string) => number;
  /** Can another unit of this item be put on the document at all? */
  canAdd: (item: InventoryItem) => boolean;
  /** Lines already asking for more than the item has (a restored draft can). */
  overLines: DocLine[];
  /** The consolidated overdraw, straight from the posting engine. Empty when unenforced. */
  violations: NegativeStockViolation[];
}

interface Options {
  mode: DocMode;
  items: InventoryItem[];
  lines: DocLine[];
}

/**
 * The stock ceilings for an in-progress document.
 *
 * `allowNegativeStock` is read as a LIVE Zustand selector, never snapshotted:
 * flipping it mid-session must lift every clamp on the next render, not on the
 * next mount.
 *
 * Sale only. `useDocumentForm` is shared with the purchase form, where buying
 * MORE of something cannot overdraw anything — so `enforced` is false there and
 * the incoming flow is provably untouched.
 */
export function useStockCeilings({ mode, items, lines }: Options): DocStock {
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);
  const enforced = mode === 'sale' && !allowNegativeStock;

  const onHand = useMemo(() => onHandOf(items), [items]);

  const maxQtyById = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const l of lines) map[l.id] = maxQtyForLine(l, lines, onHand, enforced);
    return map;
  }, [lines, onHand, enforced]);

  const headroomFor = useCallback(
    (itemId: string) => headroomForItem(itemId, lines, onHand, enforced),
    [lines, onHand, enforced],
  );

  // A fresh line starts at qty 1, so an item with no headroom left cannot be
  // picked again — even though it is "in stock", this document has already
  // claimed all of it.
  const canAdd = useCallback(
    (item: InventoryItem) => !enforced || headroomFor(item.id) >= 1,
    [enforced, headroomFor],
  );

  const violations = useMemo(
    () => lineViolations(lines, onHand, enforced),
    [lines, onHand, enforced],
  );

  // A draft restored from MMKV may carry qtys that were fine yesterday and are
  // not today. His numbers are NOT rewritten under him — the offending rows are
  // named, and he decides.
  const overLines = useMemo(() => {
    if (!enforced) return [];
    const offending = new Set(violations.map((v) => v.itemId));
    return lines.filter((l) => l.itemId !== null && offending.has(l.itemId));
  }, [enforced, violations, lines]);

  return { enforced, onHand, maxQtyById, headroomFor, canAdd, overLines, violations };
}
