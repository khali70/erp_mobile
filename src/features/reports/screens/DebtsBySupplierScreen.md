# ديون الموردين — Debts by Supplier (Payables / AP)

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 6.

## Purpose
What the shop owes suppliers. Payables (AP) rolled up per supplier.

## UX
- List of suppliers with a non-zero balance, sorted by amount owed.
- Row: name, phone, total owed, oldest-due age. Tap → unpaid purchase documents + payments.
- Record a payment to a supplier → reduces balance, posts cash-out.

## Navigation
- **In**: Reports hub; Home KPI «ديون عليك (موردون)».
- **Out**: supplier detail; record-payment flow.

## Why needed
The mirror of AR. Tells the owner what's due out so cash is planned, not surprised.

## Guard-rails
Balances derived from unpaid purchase documents − payments. Integer minor units. Never hand-edited.
