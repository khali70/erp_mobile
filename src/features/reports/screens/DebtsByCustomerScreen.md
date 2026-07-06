# ديون الزبائن — Debts by Customer (Receivables / AR)

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 6.

## Purpose
Who owes the shop, and how much. Receivables (AR) rolled up per customer, with aging.

## UX
- List of customers with a non-zero balance, sorted by amount owed.
- Each row: name, phone, total owed, oldest-debt age. Tap → their unpaid documents + payment history.
- Record a payment against a customer → reduces balance, posts cash-in.

## Navigation
- **In**: Reports hub; Home KPI «ديون لك (زبائن)».
- **Out**: customer detail; record-payment flow.

## Why needed
Uncollected debt is the small shop's biggest cash-flow blind spot. Aging turns "someone owes me" into "collect from X, they're 45 days late."

## Guard-rails
Balances derived from unpaid sale documents − payments. Integer minor units. Never hand-edited.
