# التقارير — Reports Hub Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 6.

## Purpose
Entry point to all analytics. A list of report tiles the owner can open, favorite, and reorder.

## UX
- List/grid of reports, each favoritable (star) with a menu.
- Reports: الأرباح والخسائر (P&L) · ديون الزبائن (AR) · ديون الموردين (AP) · حركة المخزون (stock movement) · المبيعات/الشراء حسب … · دفتر النقدية.
- Reorder to surface what the owner checks most.

## Navigation
- **In**: Home tile «التقارير».
- **Out**: opens each report screen (ProfitLoss, DebtsByCustomer, DebtsBySupplier, CashBook, …).

## Why needed
The analytics are *why the owner keeps the app*. This hub organizes them so the daily questions (profit, who owes, what is on shelf) are one tap away.

## Guard-rails
All figures read the immutable ledger at weighted-average cost. No cached/edited totals.
