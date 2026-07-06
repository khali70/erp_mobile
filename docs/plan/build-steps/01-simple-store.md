# Step 1 — Simple Store (build lens)

> Full spec: [`../step-1-simple-store.md`](../step-1-simple-store.md). This is the build-lens summary tying that spec to the finished web UI.
> **Goal:** items CRUD + incoming/outgoing stock via an immutable ledger + derived on-hand + per-item movement, fully offline. First shippable app.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `ProductsScreen.tsx` (البضائع) | `features/inventory/screens/ItemsListScreen` | search, filter chips, qty badge (in/low/out), price, add/edit/delete |
| `DirectoryModals: AddItem` | `features/inventory/components/ItemFormSheet` | name, category, unit, cost/sale price, low-stock threshold, optional barcode placeholder |
| `DashboardScreen` shell | `features/inventory/screens/HomeScreen` | already ported (teal header, KPI grid, quick actions, tiles). KPIs = static until their step wires them. |

## Entities / schema (see `data-model.md`)

- `items` — id, name, category, unit, `cost_price`/`sale_price` (INTEGER minor units), `currency`, `low_stock_threshold`, barcode?, + 4 standard columns (`id`, `created_at`, `updated_at`, `deleted_at`).
- `documents` + `document_lines` — the immutable in/out ledger (double-sided: positive qty + direction ±1). Incoming = +1, outgoing = −1.
- `stock_levels` — cached on-hand per item (derived from ledger, recomputed on post).
- On-hand = Σ(line.qty × direction). Never a hand-edited number.

## Key flows (port intent)

- Add/edit/duplicate item → write `items` row. Delete = **soft delete** (`deleted_at`, archive-never-delete).
- Record incoming → post a document (+1) with lines → stock_levels += ; movement row is permanent.
- Record outgoing → post a document (−1) → stock_levels −= (respect `allowNegativeStock` flag, default block).
- Per-item movement = chronological ledger view with running balance ("why is this 12?" answerable).

## Guard-rails (never port from mock)

- **SW1** money = INTEGER minor units, not float. `src/utils/money.ts`.
- **SW2** stock = ledger post, never `quantity - n` mutation.
- **SW4** doc numbers = counter/UUIDv7, not `random()`.
- **SW5** SQLite is truth; correct after restart.

## Dashboard wiring

- `قيمة المخزون` (stock value) → Σ(on_hand × cost or sale) computed from repo. First real KPI.

## Done when

User can add items, record incoming + outgoing offline, and current stock + per-item movement are always correct after app restart. `tsc` clean, runs on device via dev client (not Expo Go).
