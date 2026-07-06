# دفتر النقدية — Cash Book Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Single running ledger of every cash movement — money in (sales paid, customer debt payments) and money out (purchases paid, supplier payments, expenses). Answers "where did the cash go?"

## UX
- Chronological rows: date, source (sale/purchase/expense/payment), in/out amount, running balance.
- Filter by date range / direction.
- Read-only aggregation — entries originate from documents, expenses, and payments, not typed here.

## Navigation
- **In**: Home tile / Reports «دفتر النقدية».
- **Out**: tap a row → its source document/expense.

## Why needed
Cash is the owner's daily reality. The cash book ties sales, purchases, and expenses into one truth of liquidity, independent of accrual profit.

## Guard-rails
Derived from posted movements only. Integer minor units. Never a standalone editable balance.
