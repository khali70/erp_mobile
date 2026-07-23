# البضائع — Items / Catalog Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 1.

## Purpose
The product catalog — the foundation everything else references. Add, edit, search items and see live stock at a glance.

## UX
- Search bar (name/barcode) + scan button.
- Filter chips: all / low stock (warning) / out of stock (danger).
- Rows: photo, name, category, price, **live qty badge** (in/low/out state).
- ＋ opens the item form sheet (name, category, unit, cost/sale price, barcode, low-stock threshold, photo). Tap a row → edit.

## Navigation
- **In**: Home tile «البضائع» (count badge).
- **Out**: item form sheet (add/edit); Scan for barcode.

## Why needed
No catalog, no ERP. Items are referenced by every document, movement, and report. Fast add/edit/duplicate is the speed-of-entry hill.

## Guard-rails
Money = integer minor units. Stock qty is **derived** (stock_levels cache over the ledger), never edited here. NativeWind-only; strings via i18n.
