# Completion Plan — build all remaining app screens

Goal: turn the 12 placeholder routes into real screens, feature-complete ERP per the locked specs. Port web UI visuals only; re-implement all money/stock/debt on SQLite per guard-rails.

## Ground rules (every screen, non-negotiable)
- **NativeWind `className` only** — no `StyleSheet`, no hex literals; colors via `src/theme/colors.js` tokens (style-guide palette).
- **i18n** — all copy via `t()`, `ar`/`en` locales. No hardcoded Arabic in components.
- **Money = integer minor units.** No float anywhere.
- **Immutable ledger.** Stock on-hand + party debt are **derived** from posted documents, never hand-mutated.
- **Weighted-average COGS** for P&L.
- Layered: `screen → hook → repository → db`. Screens dumb. DB only in repositories.
- Each screen: build UI + repository + hook + wire real route (swap PlaceholderScreen) + i18n keys.

## Prerequisite decisions (baked in — reject on review to change)
1. **Item variants → parent + variants.** Clothing = size×color matrix. `items` = style/parent; new `item_variants` table (size, color, own barcode, own stock_level). Flat-SKU rejected. *Touches Step 1 schema + Goods/ItemDetail — do this migration before the money loop or pay it later.*
2. **Party picker → in-modal search by name/phone + quick-add + walk-in.** Per `04-new-outgoing.md §2a`. Shared `<PartyPicker>` component used by both sale + purchase.

## Phase A — finish in-flight (small, unblocks Home)
- Localize `HomeScreen` (fork 4fb3 killed mid-run — redo cleanly, all strings → `t()`).
- Wire Home tiles/actions `onPress → navigation.navigate(route)` (10 lines, was blocked by localize fork).
- **ItemDetail** screen (`03`) — real screen or confirm ItemFormSheet modal covers it.
- Adds `item_variants` migration + Goods/ItemDetail variant UI (per decision 1).

## Phase B — Parties complete (`13`,`14`)
- Suppliers list screen (mirror Customers). Shared party components.
- `<PartyPicker>` shared component (decision 2).
- `partyRepository` — derived balance from documents (AR/AP), never mutated.

## Phase C — Money loop (core — `04`,`05`,`06`)
- **New Outgoing (sale)** — line items, PartyPicker, cash-paid → live remaining-debt, walk-in blocks debt, atomic post (stock− + debt+ in one txn).
- **New Incoming (purchase)** — lines w/ unit cost → feeds weighted-avg cost.
- **Documents list** — posted docs, filter in/out.
- `documentRepository` + `stockRepository` (ledger post, derive stock_levels).

## Phase D — Cash + Expenses (`11`,`12`)
- Expenses screen → cash book entries → P&L OpEx.
- Cash book screen — cash in/out ledger.
- `cashRepository`, `expenseRepository`.

## Phase E — Reports (`07`,`08`,`09`,`10`)
- Reports list hub.
- **P&L** — revenue − weighted-avg COGS − expenses; loss-aware.
- **AR** (debts by customer) + **AP** (debts by supplier) — w/ aging buckets (UX-review gap fix).
- Report repositories = read-only aggregation queries.

## Phase F — Settings + Backup (`15`, Step 8)
- Settings screen (currency, valuation, negative-stock flag, language switch, app-lock toggle).
- **Local backup/restore** (JSON export + `expo-sharing` / `expo-document-picker`) — the trust anchor.
- CSV export. Optional PIN/biometric app-lock.

## Orchestration (avoid fork collisions)
Assign **disjoint file sets** per parallel fork — one feature folder each. Phases C–F run parallel by feature (parties / documents / cash / reports / settings own separate dirs). Phase A + variant migration run FIRST and alone (touches shared schema + Home). After each phase: `tsc --noEmit` = 0, then device build + screenshot verify.

## Definition of done
All 15 screens real (no PlaceholderScreen left), tsc 0, app builds + runs on device, RTL/Arabic correct, money integer, stock/debt derived, local backup works.
