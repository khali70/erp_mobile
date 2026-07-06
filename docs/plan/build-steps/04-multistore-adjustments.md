# Step 4 — Multi-store & Adjustments

> **Goal:** more than one store/warehouse, stock transfer between stores, inventory-count documents, and count-driven adjustments. The Dashboard store selector becomes real.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `DashboardScreen` store selector (`StoreBranch`) | `features/stores/components/StorePicker` | header selector; active store scopes every stock view |
| (new) transfer doc form | `features/documents/screens/TransferDocScreen` | out of A, into B, atomic |
| (new) inventory-count form | `features/documents/screens/InventoryCountScreen` | counted qty per item per store → adjustment |

> The web mock has a `StoreBranch` model + selector but treats stores as static KPI seeds. Port the **selector UX**; build the real per-store stock model underneath.

## Entities / schema (see `data-model.md`)

- `stores` — id, name, location, + standard columns. `location_id`/`store_id` already reserved on movement rows from Step 1 so this is additive, not a re-architecture.
- Add `store_id` to `documents` / `document_lines` / `stock_levels` (stock is per item **per store**).
- `transfer_docs` — a document that writes **two** ledger legs: −qty at source store, +qty at destination (conserves total).
- `inventory_count_docs` + `stock_adjustments` — counted vs system → adjustment movement row (never a silent quantity edit).

## Key flows (port intent)

- **Active-store selector** scopes items list, stock levels, movement, and new documents to that store.
- **Transfer:** pick source + destination + lines → post atomic two-leg document → totals conserved.
- **Count:** capture counted qty per item → diff vs on-hand → write `stock_adjustment` movement rows so the discrepancy is logged and explainable.

## Guard-rails (never port from mock)

- **SW2** transfers + counts are **posted documents / adjustment movements**, never direct `quantity` edits.
- Transfer must be atomic (both legs in one DB transaction) — a transfer that debits A without crediting B is a bug.
- Count adjustments write a movement row with reason, preserving the audit trail.
- Per-store on-hand derived from ledger filtered by `store_id`.

## Dashboard wiring

- KPI cards recompute for the **selected store**; a store switch re-queries, never reads a seed.
- Optional: all-stores rollup view.

## Done when

Stock is tracked per store, transfers conserve total quantity across two legs atomically, and a completed count writes adjustments that reconcile counted vs system stock. Correct after restart.
