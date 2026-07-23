# وارد جديد — New Incoming (Purchase) Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Record a **goods-in document** (a purchase from a supplier). Increments stock, updates each item's **weighted-average cost**, and — if not fully paid — creates **supplier debt (AP)**. **This is the ONLY place debt is created.**

## UX
- Header: date + store selector.
- **Supplier picker** — search by name/phone, quick-add inline, **existing-balance hint** («عليه دين: ٨,٥٠٠ ج.م»). Supplier debt is real and tracked.
- **Line items** — add item by **search only** (no barcode scan here), qty, **unit cost** (`تكلفة الوحدة`, drives avg-cost + future COGS). Live totals.
- **Totals card** — total, **cash paid (editable) → remaining = supplier debt** (`max(0, total − paid)`), live.
- Save = atomic: +stock, recompute weighted-avg cost, +cash-out for paid amount, +supplier debt (AP) for remainder.

## Navigation
- **In**: Home quick action «وارد جديد»; Documents list.
- **Out**: back on save; opens supplier quick-add. **No Scan route** (removed).

## Why needed
Buying stock is where cost enters the system. Capturing unit cost here makes COGS and true profit possible. Supplier debt (AP) is how the shop tracks what it owes vendors.

## Locked feedback (2026-07-07 — owner)
1. **REMOVE barcode scan** (screenshot annotated — scan button crossed out). Purchase = **type unit cost**, not scan-sell. Scan is a sell-side action only; delete the «مسح باركود» button from this screen.
2. **Keep supplier debt (AP).** Partial cash-paid → remaining becomes supplier debt. This is the ONE debt path in the whole app.
3. **Never lose data — draft autosave.** Persist in-progress purchase to SQLite on every change; restore on reopen (same as sale screen).
4. **Speed** — unit-cost field tap-to-type; qty tap-to-type in addition to stepper.

## Guard-rails
Integer minor units. Weighted-average cost recompute on every incoming line. Stock via ledger. `supplier_debt = max(0, total − paid)`. **Supplier is the only debtor party in the system.**
