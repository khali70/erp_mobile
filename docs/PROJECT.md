# Rafuf (رفوف) — Project Reference

> Single source of truth for **what this app is** and **what every screen does**.
> Each screen's local `*.md` links back here. Read this first.

---

## 1. Overall goal

A **local, single-user, full ERP** for a small Arabic retail shop (men's clothing is the reference domain). One shopkeeper, one phone. The phone **is** the database — no backend, no accounts, no cloud sync, no multi-user. Clone-family of "الجرد والمخزون ببساطة" (Stock & Inventory Simple).

It answers the questions a shop owner actually asks:
- What do I have in stock, and what's it worth?
- Who owes me (زبائن / receivables), and who do I owe (موردون / payables)?
- What sold, what didn't, and **am I making a profit**?
- Where did my cash go?

**Two hills to die on:** speed of data entry, and never lose data.

### Locked principles
- **Local-first** — every write hits local SQLite synchronously and always succeeds. Works identically in airplane mode.
- **SQLite + Drizzle = single source of truth.** Zustand is UI state only. No TanStack as a data layer.
- **Movement-log-centric stock** — on-hand is *derived from an immutable ledger* (documents + lines), never a hand-edited number. Every quantity is explainable.
- **Money = integer minor units** (piastres), never float. Currency per row (EGP default).
- **Weighted-average valuation** for COGS / P&L.
- **RTL Arabic** from day one. Cairo font.
- **Archive, never hard-delete.** Backup before any destructive action.

### Out of scope (permanent)
Cloud, backend/API, auth/accounts, multi-device sync, roles/RBAC. App-lock (PIN/biometric) is the only optional gate. Data safety = **local backup/restore + CSV export**, not cloud.

---

## 2. Architecture (see `AGENTS.md` for the full contract)

- **Stack**: React Native + Expo (dev build, **not** Expo Go — native modules), TypeScript strict, NativeWind-only styling, React Navigation native-stack, zustand (UI), expo-sqlite + Drizzle.
- **Layers**: `screens → hooks → repositories → db`. Lower never imports upward.
- **Feature isolation**: a feature owns its screens/components/hooks/repositories. Features never import siblings; cross-feature need → promote to `src/` shared.
- **Styling law**: NativeWind `className` only. `StyleSheet` banned in app code. Colors live in `src/theme/colors.js` + `tailwind.config.js`. Canonical palette in `docs/plan/design-prompts/00-style-guide.md`.
- **Web prototype** (`arabic-retail-erp-mobile-desig`) is a **UX reference only** — port the flows + Arabic copy, re-implement all money/stock on SQLite. Never copy its float money or direct-mutation logic.

---

## 3. Screen map — usage of each feature/screen

Navigation is a native-stack; **Home** is the hub. Routes are declared in `src/navigation/RootNavigator.tsx`.

| Screen (route) | Feature | Arabic | What it's for | Step |
|---|---|---|---|---|
| `Home` | inventory | الرئيسية | Dashboard hub — KPIs (stock value, month profit, AR, AP) + quick actions + section tiles | 1 |
| `Items` | inventory | البضائع | Product catalog — add/edit/search items, live stock badges | 1 |
| `NewOutgoing` | documents | صادر جديد | Sell / goods-out — customer picker, lines, payment→debt, decrements stock | 3 |
| `NewIncoming` | documents | وارد جديد | Buy / goods-in — supplier picker, lines w/ unit cost, increments stock + avg cost | 3 |
| `Documents` | documents | المستندات | List of all in/out documents; open one to view/reverse | 3 |
| `Customers` | parties | الزبائن | Customer list + balances (receivables); pick at point of sale | 2 |
| `Suppliers` | parties | الموردون | Supplier list + balances (payables) | 2 |
| `Expenses` | expenses | النفقات | Record shop costs (rent/salary/fuel) → feeds cash book + P&L OpEx | 5 |
| `CashBook` | cashbook | دفتر النقدية | Cash in/out ledger — every money movement in one running view | 3 |
| `Reports` | reports | التقارير | Report hub — links to all analytics below | 6 |
| `ProfitLoss` | reports | الأرباح والخسائر | P&L: revenue − COGS (weighted-avg) − expenses = profit | 6 |
| `DebtsByCustomer` | reports | ديون الزبائن | Receivables (AR) — who owes the shop, aging | 6 |
| `DebtsBySupplier` | reports | ديون الموردين | Payables (AP) — what the shop owes | 6 |
| `Scan` | scan | مسح الباركود | Camera barcode scan (+ HID scanner ready) — resolve/add items | 7 |
| `Settings` | settings | الإعدادات | Currency, valuation, negative-stock flag, backup/restore, app-lock, language | 8 |

---

## 4. Core cycle (how the pieces connect)

```
Item (catalog)
   │
   ├─ NewIncoming ──▶ +stock, sets/updates weighted-avg cost, supplier debt (AP)
   └─ NewOutgoing ──▶ −stock, revenue, customer debt (AR), COGS at avg cost
                          │
        Expenses ────────┤
                          ▼
                     CashBook (cash in/out)  +  P&L (revenue − COGS − expenses)
                          │
                     Reports (AR / AP / P&L / stock movement / cash book)
```

Stock is a **consequence** of posted documents. Debts are **derived** from unpaid document balances, not hand-edited. P&L reads the immutable ledger at weighted-average cost.

---

## 5. Build steps

Detailed per-step specs live in `docs/plan/build-steps/`. Roadmap in `docs/plan/roadmap.md`; canonical schema in `docs/plan/data-model.md`.

Step 1 Store · Step 2 Parties+Debts · Step 3 Pricing/Money/CashBook · Step 4 Multi-store/Adjustments · Step 5 Expenses · Step 6 Reports/P&L · Step 7 Barcode · Step 8 Settings/Backup. (No Step 9.)

---

## 6. Open decisions
- **Variant model** — flat SKU vs parent+variants (clothing = size×color). Recommendation: parent+variants. Affects Step 1 schema.
- **Customer picker** — in-modal search of existing customers by name/phone at sale time (spec: `design-prompts/04-new-outgoing.md §2a`).
- **Backup destination** — local file/share sheet only, or optional user-chosen Drive/iCloud file (still user-driven, not sync).
