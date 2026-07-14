// THE OVERDRAW RULE, ON THE FORM SIDE — pure. No React, no IO.
//
// The rule itself is NOT redefined here: `negativeStockViolations`
// (src/features/inventory/posting.ts) is the engine the repository posts
// through, and it is the engine this module asks. Two copies of "may he sell
// this?" is how the picker starts disagreeing with the ledger.
//
// What this module adds is the FORM's projection of that rule:
//   • the ceiling for ONE line, given every OTHER line already on the document;
//   • the headroom left for an item the owner is about to pick again.
//
// Both are aggregate: the ceiling belongs to the ITEM, not to the row. The same
// item added twice as two lines shares one ceiling — exactly what
// `negativeStockViolations` sums before it judges. A clamp that looks only at the
// row it is on passes every obvious test and still oversells.
import {
  OUT,
  negativeStockViolations,
  type NegativeStockViolation,
  type PostingDoc,
} from '@/features/inventory/posting';
import type { InventoryItem } from '@/features/inventory/types';
import type { DocLine } from '../types';

/** On-hand per item id, as the form knows it (from `useItems`). */
export type OnHand = Record<string, number>;

export function onHandOf(items: InventoryItem[]): OnHand {
  const map: OnHand = {};
  for (const i of items) map[i.id] = i.qty;
  return map;
}

/**
 * Total qty this document requests per item id. Fast-entry / CSV lines
 * (`itemId === null`) have no known item yet and cannot be judged — they are
 * resolved by find-or-create at post time, where the repository guard sees them.
 */
export function requestedByItem(lines: DocLine[]): Record<string, number> {
  const requested: Record<string, number> = {};
  for (const l of lines) {
    if (l.itemId === null) continue;
    requested[l.itemId] = (requested[l.itemId] ?? 0) + l.qty;
  }
  return requested;
}

/**
 * The upper bound for one line's qty — `null` when unbounded (not enforced, or
 * an unresolved fast-entry line).
 *
 * on-hand MINUS what the document's OTHER lines already claim of the same item.
 * Two lines of an item with 10 on hand, one at 4: the other's ceiling is 6.
 */
export function maxQtyForLine(
  line: DocLine,
  lines: DocLine[],
  onHand: OnHand,
  enforced: boolean,
): number | null {
  if (!enforced || line.itemId === null) return null;
  const claimedByOthers = (requestedByItem(lines)[line.itemId] ?? 0) - line.qty;
  return Math.max(0, (onHand[line.itemId] ?? 0) - claimedByOthers);
}

/** How many more units of an item the document can still take. ∞ when unenforced. */
export function headroomForItem(
  itemId: string,
  lines: DocLine[],
  onHand: OnHand,
  enforced: boolean,
): number {
  if (!enforced) return Infinity;
  return Math.max(0, (onHand[itemId] ?? 0) - (requestedByItem(lines)[itemId] ?? 0));
}

/** Clamp a requested qty down to the line's ceiling (lower bounds stay the caller's). */
export function clampQty(
  line: DocLine,
  lines: DocLine[],
  onHand: OnHand,
  enforced: boolean,
  next: number,
): number {
  const max = maxQtyForLine(line, lines, onHand, enforced);
  return max === null ? next : Math.min(next, max);
}

/**
 * What the document overdraws, per item — the SAME function the repository posts
 * through, handed the form's lines and the form's on-hand. Empty when unenforced.
 */
export function lineViolations(
  lines: DocLine[],
  onHand: OnHand,
  enforced: boolean,
): NegativeStockViolation[] {
  const posting: PostingDoc = {
    status: 'posted',
    direction: OUT,
    lines: lines
      .filter((l): l is DocLine & { itemId: string } => l.itemId !== null)
      .map((l) => ({ itemId: l.itemId, qty: l.qty })),
  };
  return negativeStockViolations(onHand, posting, !enforced);
}
