# صادر جديد — New Outgoing (Sale) Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Record a **goods-out document** (a sale). Decrements stock, books revenue, and — if not fully paid — creates customer debt (AR). This is the shop's most-used money screen.

## UX
- Header: date + store selector.
- **Customer picker** — search existing customers by **name or phone**, quick-add a new one inline ("＋ زبون جديد"), or **walk-in** chip (بيع نقدي, no customer = no debt allowed). Shows existing debt hint on select.
- **Line items** — add item (search or **barcode scan**), qty, unit price (defaults to sale price). Live line totals.
- **Totals card** — total, cash paid (editable) → **remaining = debt** (`max(0, total − paid)`), live.
- Save = atomic: −stock, +revenue, +customer debt, COGS at weighted-avg cost.

## Navigation
- **In**: Home quick action «صادر جديد»; Documents list (＋).
- **Out**: back to Home/Documents on save; opens Scan for barcode; opens customer quick-add.

## Why needed
Selling is the core event that moves stock **and** money. Without it there's no revenue, no AR, no P&L. The walk-in/debt guard prevents anonymous debt.

## Guard-rails (never port from web prototype)
Money = integer minor units. Stock via ledger, never direct mutation. `debt = max(0, total − paid)`. Walk-in blocks debt.
