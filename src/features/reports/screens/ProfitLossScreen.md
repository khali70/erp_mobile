# الأرباح والخسائر — Profit & Loss Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 6.

## Purpose
The P&L statement — the single number the owner cares about. **Revenue − COGS − expenses = profit**, for a chosen period.

## UX
- Period selector (this month / range).
- Lines: revenue (from sales), COGS (weighted-avg cost of sold items), gross profit, operating expenses, **net profit** (loss shown in red).
- Drill each line to its source (sales, movements, expenses).

## Navigation
- **In**: Reports hub «الأرباح والخسائر»; Home KPI «أرباح الشهر».
- **Out**: drills into sales / expenses detail.

## Why needed
Everything else feeds this. It's the reason for capturing unit cost, weighted-avg valuation, and expenses. Without a truthful P&L the app is just a stock counter.

## Guard-rails
COGS = weighted-average cost from the ledger. Integer minor units. Loss-aware (never clamp negatives).
