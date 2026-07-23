# الزبائن — Customers List Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 2.

## Purpose
List of customers with each one's **balance = what they owe the shop (receivables / AR)**. Manage customers and see debt at a glance.

## UX
- Search by name/phone. Rows: name, phone, balance (warning color if owed).
- Tap → customer detail (contact, purchase history, running balance, payments).
- ＋ add customer (name required, phone optional).
- Same records feed the **customer picker at point of sale** (NewOutgoing) with in-modal search + quick-add + walk-in.

## Navigation
- **In**: Home tile «الزبائن»; customer picker in NewOutgoing.
- **Out**: customer detail; back to Home.

## Why needed
Debts-by-customer is a headline report. Customers are picked at sale time and resolved against here. AR is half the shop's cash-flow picture.

## Guard-rails
Balance **derived** from unpaid sale documents + payments — never hand-edited. Integer minor units. NativeWind-only; strings via i18n.
