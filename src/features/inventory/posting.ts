// Step-1 stock engine — PURE. No React, no IO, no SQL. The repository layer
// materializes these results into SQLite; this module owns the correctness.
//
// Model (data-model.md §5): stock is the running total of an append-only ledger.
// A document header carries a `direction` (+1 in / -1 out); each line carries a
// positive `qty`. On-hand(item) = Σ(qty * direction) over that item's lines in
// POSTED documents only. Draft documents have no stock effect.

export type Direction = 1 | -1;
export const IN: Direction = 1;
export const OUT: Direction = -1;

export type DocStatus = 'draft' | 'posted';

export interface LedgerLine {
  itemId: string;
  qty: number; // positive magnitude (fractional allowed, e.g. kg)
}

export interface PostingDoc {
  status: DocStatus;
  direction: Direction;
  lines: LedgerLine[];
}

/** Signed stock delta of one line under a document direction. */
export function signedQty(qty: number, direction: Direction): number {
  return qty * direction;
}

/** On-hand per item id, derived from POSTED docs only. */
export function computeOnHand(docs: PostingDoc[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const d of docs) {
    if (d.status !== 'posted') continue;
    for (const l of d.lines) {
      map[l.itemId] = (map[l.itemId] ?? 0) + signedQty(l.qty, d.direction);
    }
  }
  return map;
}

/** On-hand for a single item across posted docs. */
export function onHandForItem(docs: PostingDoc[], itemId: string): number {
  return computeOnHand(docs)[itemId] ?? 0;
}

export interface NegativeStockViolation {
  itemId: string;
  available: number; // current on-hand before this doc
  requested: number; // total qty this outgoing doc removes for the item
}

/**
 * Guard for posting an OUTGOING document. Returns the items whose requested
 * quantity would drive on-hand below zero. Empty when `allowNegative` is true
 * or nothing overdraws. Quantities are aggregated per item across the doc's
 * lines (two lines for the same item sum before the check).
 */
export function negativeStockViolations(
  currentOnHand: Record<string, number>,
  outgoing: PostingDoc,
  allowNegative: boolean,
): NegativeStockViolation[] {
  if (allowNegative) return [];
  const requested: Record<string, number> = {};
  for (const l of outgoing.lines) {
    requested[l.itemId] = (requested[l.itemId] ?? 0) + l.qty;
  }
  const violations: NegativeStockViolation[] = [];
  for (const itemId of Object.keys(requested)) {
    const available = currentOnHand[itemId] ?? 0;
    if (requested[itemId] > available) {
      violations.push({ itemId, available, requested: requested[itemId] });
    }
  }
  return violations;
}

export interface MovementRow {
  itemId: string;
  direction: Direction;
  qty: number;
  signedQty: number;
  runningBalance: number;
}

/**
 * Chronological movement for one item with a cumulative running balance.
 * `orderedDocs` must already be in ledger order (oldest first) and posted.
 * The final runningBalance equals the item's on-hand.
 */
export function itemMovement(
  orderedDocs: PostingDoc[],
  itemId: string,
): MovementRow[] {
  const rows: MovementRow[] = [];
  let balance = 0;
  for (const d of orderedDocs) {
    if (d.status !== 'posted') continue;
    for (const l of d.lines) {
      if (l.itemId !== itemId) continue;
      const s = signedQty(l.qty, d.direction);
      balance += s;
      rows.push({
        itemId,
        direction: d.direction,
        qty: l.qty,
        signedQty: s,
        runningBalance: balance,
      });
    }
  }
  return rows;
}
