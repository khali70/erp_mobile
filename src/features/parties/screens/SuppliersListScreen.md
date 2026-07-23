# الموردون — Suppliers List Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 2.

## Purpose
List of suppliers with each one's **balance = what the shop owes them (payables / AP)**. Manage supplier records and see debt at a glance.

## UX
- Search by name/phone. Rows: name, phone, balance (red if owed).
- Tap → supplier detail (contact, purchase history, running balance, payments).
- ＋ add supplier (name required, phone optional).

## Navigation
- **In**: Home tile «الموردون»; supplier picker in NewIncoming.
- **Out**: supplier detail; back to Home.

## Why needed
The other half of the debt story. AP tells the owner what's due out. Suppliers are also picked at purchase time, so this is the record they resolve against.

## Guard-rails
Balance is **derived** from unpaid purchase documents + payments — never hand-edited. Integer minor units.
