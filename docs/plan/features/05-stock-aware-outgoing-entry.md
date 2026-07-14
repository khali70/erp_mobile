# 05 — Stock-Aware Outgoing Document Entry

> Prompt artifact for the `rn-feature-builder` agent. Not an implementation.

## FEATURE NAME

Stock-Aware Outgoing Document Entry (block overdraw at selection & quantity, not at post)

---

## CONTEXT

Outgoing (sale) documents are built in `src/features/documents/screens/NewOutgoingScreen.tsx`, a layout-only shell over `useDocumentForm('sale')`. Today:

- `LineItemPicker` lists **all** items — including `qty <= 0` — and never disables selection. It already renders on-hand (`documents.itemPicker.onHand`), so the data is on screen but not enforced.
- Quantity has **no upper bound**: `mutateQty(id, ±1)` = `Math.max(1, l.qty + delta)`; `setQty(id, qty)` = `Math.max(0, qty)`; `scanAppend` bumps `qty + 1` unconditionally.
- The only stock guard is server-side in `document-repository.postInternal` (direction `OUT`), which throws `NegativeStockError`. `useDocumentForm.save()` catches it and shows a generic `Alert` with `documents.errors.negativeStock` ("Requested quantity exceeds available stock.") — item-less, after the user already committed the whole doc.

Goal: move the stock constraint **forward** into the picker and the qty stepper so overdraw is prevented (or explicitly acknowledged), and when it still reaches the repository, the error names the offending items instead of being generic. Must respect the existing `allowNegativeStock` escape hatch.

---

## REFERENCE

Existing screen: `src/features/documents/screens/NewOutgoingScreen.tsx` (+ `NewOutgoingScreen.md`).
Components to change/extend, not replace: `LineItemPicker.tsx`, `DocLineRow.tsx`, `DocLinesSection.tsx`, `ScanPane.tsx`, `DocFormModals.tsx`.
Stock badge conventions already exist: `src/utils/stock.ts` → `getStockStatus(qty, lowStockThreshold)`, i18n `items.status.low` / `items.status.out`.
Incoming (purchase) flow must be **unaffected** — `useDocumentForm` is shared by both modes; gate all new behavior on `mode === 'sale'`.

---

## DATA SPEC

Local SQLite (Drizzle + expo-sqlite), no REST backend. No warehouse dimension — `stock_levels` is keyed by `item_id` alone (`src/db/schema.ts:95`).

**Already available — reuse, do not add new queries:**

- `src/features/inventory/hooks/useItems.ts` → `useItems(): { items: InventoryItem[], reload }`. `InventoryItem.qty` **is on-hand** (mapped from `stockLevels.qtyOnHand` in `src/features/inventory/mappers.ts`). `useDocumentForm` already holds this as `f.items`, so available stock is in memory client-side with zero extra reads.
- `src/repositories/item-repository.ts` → `listWithStock(): ItemWithStock[]` (`qtyOnHand`, `lowStockThreshold`), `findByNameAndCategory(name, category)`, `getById(id)`.
- `src/repositories/document-repository.ts` → `onHand(itemId: string): number` (cached on-hand, 0 when never moved), `create(input, { allowNegative })`, `post(id, opts)`, `class NegativeStockError` carrying `violations: { itemId: string; available: number; requested: number }[]`.
- `src/features/inventory/posting.ts` → `negativeStockViolations(currentOnHand, outgoing, allowNegative): NegativeStockViolation[]` — the pure engine; reuse it for the client-side pre-check rather than writing a second rule.
- `src/store/settings-store.ts` → `useSettingsStore`, `allowNegativeStock: boolean` (MMKV-persisted, default `false`). **This is the sole gate. Every new restriction must be a no-op when `allowNegativeStock === true`.**

**Lines with no `itemId`:** quick-entry (`addQuickLine`) and CSV import (`importLines`) create lines with `itemId: null`, resolved by find-or-create at post time. These have no known on-hand until resolved — treat as unconstrained in the UI, but they must still surface a named violation if the repository rejects them.

---

## BEHAVIOR

**Item picker (`LineItemPicker`)**

- Default to showing only items with `qty > 0` when `mode === 'sale'` and `allowNegativeStock === false`.
- Offer a visible way to see the rest (an "include out of stock" filter chip or a muted, non-selectable trailing group) — out-of-stock items must not silently vanish; the user needs to know the item exists but is empty.
- Out-of-stock rows, when shown, render disabled (dimmed, no press) with the existing out-of-stock badge.
- Already-added lines: a second selection of the same item should not be able to push the running requested qty past on-hand.
- When `allowNegativeStock === true`, the picker behaves exactly as it does today (no filtering, no disabling).

**Quantity (`DocLineRow` / `mutateQty` / `setQty`)**

- For `sale` lines with a known `itemId`, clamp the upper bound to that item's on-hand: `+` becomes disabled (not a no-op tap) at the ceiling; typed input clamps down to the ceiling.
- When clamped, show inline, non-blocking feedback on the row (e.g. a max hint / "only N available") rather than an alert.
- `-` and lower bounds keep current behavior (`Math.max(1, …)` for stepper, `Math.max(0, …)` for typed).
- Quick-entry / CSV lines (`itemId: null`) keep the current unbounded behavior.
- When `allowNegativeStock === true`, no ceiling is applied.

**Barcode scan (`scanAppend`)**

- Repeat scans of an item already at its on-hand ceiling do not increment; surface the same "only N available" feedback path instead of silently bumping.
- Scanning an item with `qty <= 0` under a `false` `allowNegativeStock` should be rejected with clear feedback, not appended.

**Save / post (`useDocumentForm.save`)**

- Add a client-side pre-check before `documentRepository.create(...)` using `negativeStockViolations` over `f.items` on-hand — so the doc is never sent when the UI already knows it will fail, and so the user gets one consolidated, item-named message.
- Keep the `NegativeStockError` catch as the backstop (the pre-check can be stale, and quick-entry/CSV lines resolve to real items only at post time). Upgrade the message to **name the offending items** using `violations[].itemId` → `f.items` / `itemRepository.getById`, showing requested vs. available per item.
- Success flow (`documents.saved` alert → `clearDraft()` → `navigation.goBack()`) is unchanged.

**States**

- Loading: picker inherits existing `useItems` behavior.
- Empty: if every item is out of stock and the filter is on, show a distinct empty state ("nothing in stock") separate from the existing `documents.itemPicker.empty` (no search results).
- Error: no new alert types beyond the improved `negativeStock` message.
- Offline: all reads/writes stay local SQLite; nothing changes.

**Edge cases to handle explicitly**

- Same item added twice as two lines → the ceiling is on the **sum** of requested qty for that `itemId`, matching what `negativeStockViolations` aggregates. UI clamping that only looks at a single line is a bug.
- On-hand changes between form open and save (another doc posted) → repository backstop must still fire; do not assume `f.items` is fresh.
- A restored draft (`useDocDraft`) may carry qtys that now exceed on-hand → on restore, surface which lines are over, do not silently rewrite the user's draft.
- Editing an existing posted doc / unpost path must not be broken by the new clamps.
- `allowNegativeStock` toggled to `true` mid-session → clamps must lift reactively (it's a Zustand selector; do not snapshot it).

---

## REQUIREMENTS

- Feature-first structure: `src/features/documents/{screens,components,hooks,utils,types.ts}`; stock rules belong in a hook/util, not in JSX.
- Data access only through `src/repositories/*` — screens and components never touch Drizzle.
- Reuse `negativeStockViolations` from `src/features/inventory/posting.ts` as the single source of truth for the overdraw rule; do not reimplement the aggregation in the UI.
- Reuse `getStockStatus` (`src/utils/stock.ts`) for the out-of-stock/low badges.
- `allowNegativeStock` read via `useSettingsStore` selector, applied uniformly to picker filtering, qty ceiling, scan, and pre-check.
- NativeWind + `src/theme/colors` tokens; RTL via `src/theme/rtl` (the existing `ROW` pattern in `LineItemPicker`/`DocLineRow`).
- New copy added to **both** `src/i18n/locales/ar.json` and `en.json` under the existing `documents.*` root — e.g. `documents.itemPicker.outOfStock`, `documents.itemPicker.showOutOfStock`, `documents.itemPicker.emptyInStock`, `documents.errors.negativeStockDetail` (interpolating item name / requested / available), `documents.qtyMax`. Do not invent a new i18n root.
- Reuse `src/components/ui/*` (`BottomSheet`, `SearchBar`, `FilterChips`) — no new picker primitive.
- Extend `src/repositories/document-repository.test.ts` / `src/features/inventory/posting.test.ts` coverage and add tests for the new client-side pre-check (sum-across-duplicate-lines, `allowNegative` bypass, stale-on-hand backstop).

---

## UI GUIDELINES

- One component per file; no `renderX()` helpers inside screens.
- `NewOutgoingScreen.tsx` stays a layout-only shell — no stock logic lands in it.
- Disabled affordances must look disabled (dimmed + `accessibilityState.disabled`), not merely inert on press.
- Quantity feedback is inline on the row; reserve `Alert` for the save-time consolidated violation.
- Preserve existing a11y labels (`documents.qtyInc` / `documents.qtyDec`) and add a state hint when the `+` is at ceiling.

---

## ARCHITECTURE GUIDELINES

- Business rule lives in `src/features/inventory/posting.ts` (already pure and tested). The documents feature consumes it; it does not fork it.
- New client-side stock logic goes in a dedicated hook/util under `src/features/documents/` (e.g. a `useStockCeilings`-style hook derived from `f.items` + current lines) consumed by `useDocumentForm` — keep `useDocumentForm` from growing another 100 lines of inline rules.
- `useDocumentForm` is shared by `sale` and `purchase`; every new constraint is gated on `mode === 'sale'` so incoming docs stay unconstrained.
- Preserve offline-first invariants: WAC costing, the `stock_levels` cache and `recomputeStock` path, and the single-transaction post are untouched.
- The repository stock guard stays authoritative. The UI clamp is UX, not enforcement — do not remove or weaken `postInternal`'s check.

---

## ACCEPTANCE CRITERIA

1. With `allowNegativeStock = false`, an item with `qty <= 0` cannot be added to an outgoing doc from the picker or by scanning.
2. With `allowNegativeStock = false`, the `+` stepper disables and typed input clamps at on-hand for any sale line with a known `itemId`; the ceiling accounts for the **sum** across duplicate lines of the same item.
3. Out-of-stock items are still discoverable in the picker (filter/muted group), not silently hidden.
4. With `allowNegativeStock = true`, every behavior above reverts to today's — no filtering, no ceiling, no new blocks — verified by a test.
5. Tapping save on a doc the UI already knows overdraws produces one consolidated message **naming each offending item** with requested vs. available; the document is not created.
6. When the repository still throws `NegativeStockError` (stale on-hand, quick-entry/CSV lines), the alert names the offending items rather than showing the generic string.
7. Incoming/purchase flow, WAC costing, and the `recomputeStock` path are provably unchanged (existing tests green).
8. All new copy exists in both `ar.json` and `en.json`; the picker and row render correctly in RTL.
9. `NewOutgoingScreen.tsx` gains no stock logic.
