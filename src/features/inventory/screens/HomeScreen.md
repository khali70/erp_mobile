# الرئيسية — Home / Dashboard Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 1.

## Purpose
The hub. Answers the owner's daily questions without navigating, and launches every core action.

## UX
- **Teal header** — store selector («المحل الرئيسي») + settings, subtitle.
- **2×2 KPI grid** — قيمة المخزون (stock value) · أرباح الشهر (month profit, positive) · ديون لك (receivables, warning) · ديون عليك (payables, danger). Colored dots + tinted tags, Arabic-Indic numerals.
- **3 quick actions** — صادر جديد / وارد جديد / باركود.
- **6 section tiles** — المستندات · البضائع (count badges) · النفقات · التقارير · الزبائن · الموردون.
- **Dark stats banner** — daily collection % with progress bar.

## Navigation
- **In**: app launch (initial route).
- **Out**: every tile/action routes onward (NewOutgoing, NewIncoming, Scan, Items, Documents, Expenses, Reports, Customers, Suppliers, Settings).

## Why needed
Home is the 3-questions screen: what's low, what's it worth, who owes. It's the map of the whole app.

## Guard-rails
KPI figures are **derived** from the ledger (currently static demo until repos wired). NativeWind-only styling, canonical palette. Strings via i18n `t()`.
