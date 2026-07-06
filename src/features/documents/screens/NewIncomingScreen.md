# وارد جديد — New Incoming (Purchase) Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Record a **goods-in document** (a purchase from a supplier). Increments stock, updates each item's **weighted-average cost**, and — if not fully paid — creates supplier debt (AP).

## UX
- Header: date + store selector.
- **Supplier picker** — same pattern as customer picker (search by name/phone, quick-add, existing-balance hint).
- **Line items** — add item (search or scan), qty, **unit cost** (drives avg-cost + future COGS). Live totals.
- **Totals card** — total, cash paid (editable) → remaining = supplier debt.
- Save = atomic: +stock, recompute weighted-avg cost, +supplier debt (AP).

## Navigation
- **In**: Home quick action «وارد جديد»; Documents list.
- **Out**: back on save; opens Scan; opens supplier quick-add.

## Why needed
Buying stock is where cost enters the system. Capturing unit cost here is what makes COGS and true profit possible later — cheap now, no migration.

## Guard-rails
Integer minor units. Weighted-average cost recompute on every incoming line. Stock via ledger.
