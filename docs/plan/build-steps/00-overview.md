# Build Steps — Overview

> How to turn the **finished web UI** (`arabic-retail-erp-mobile-desig`) into the real RN + Expo local ERP.
> One build-step doc per roadmap phase. Each doc = *what to build, which finished screen it ports, what to keep, what to never copy.*
> Read order: this file → the step you're building. Architecture law lives in [`../../../AGENTS.md`](../../../AGENTS.md); phases + ordering in [`../roadmap.md`](../roadmap.md); storage conventions in [`../data-model.md`](../data-model.md); UX flows + guard-rails in [`../ux-review-design-prototype.md`](../ux-review-design-prototype.md).

## The one rule that governs every step

The web app is a **UX reference, not an architecture reference.** It is in-memory `useState`, money as float, stock by direct mutation. **Copy its pixels, layout, Arabic language, and interactions. Re-implement 100% of money/stock/COGS on the SQLite/Drizzle ledger.** Every step doc repeats this as its guard-rail table — obey it.

## Screen → step map

The finished UI has these screens/modals (`arabic-retail-erp-mobile-desig/src/components/`). Each is delivered by exactly one build step:

| Web component | Arabic | Build step |
|---|---|---|
| `ProductsScreen`, `DirectoryModals: AddItem`, `ScannerModal`(find) | البضائع | **Step 1** — Simple Store |
| `DashboardScreen` (shell + KPIs, incremental) | الرئيسية | **Step 1** shell → KPIs fill in per step |
| `CustomersScreen`, `SupplierDebtsScreen`, `DirectoryModals: Customers/Suppliers`, party picker in sale/purchase | الزبائن / الموردون / الديون | **Step 2** — Parties & Balances |
| `NewSaleScreen`, `NewPurchaseScreen`, `CashBookScreen` | صادر / وارد / دفتر النقدية | **Step 3** — Pricing, Money & Cash book |
| `DashboardScreen` branch selector (`StoreBranch`), adjustment doc | تعدد المتاجر / الجرد | **Step 4** — Multi-store & Adjustments |
| `ExpensesScreen`, `DirectoryModals: Expenses` | النفقات | **Step 5** — Expenses |
| `ReportsScreen`, `DocumentsScreen` | التقارير / المستندات | **Step 6** — Reports & Analytics |
| `ScannerModal` (scan-to-line, rapid count) | مسح الباركود | **Step 7** — Barcode & Scan UX |
| `MoreScreen` (settings, reset) | المزيد / الإعدادات | **Step 8** — Settings, Backup & Polish |

> The **Dashboard** is not one step — it is a shell built in Step 1 whose KPI cards (stock value → profit → ديون لك → ديون عليك) get *real data wired* as each later step lands the underlying entity. Never let a Dashboard KPI read a hardcoded seed once its step ships.

## Cross-step guard-rails (from the software-cycle review)

| # | Web mock does | Real build MUST | Applies to |
|---|---|---|---|
| SW1 | Money = JS `number` / `parseFloat` / `toFixed` | **Integer minor units** (piastres), `src/utils/money.ts` | 3, 5, 6 |
| SW2 | Stock = `quantity - deduct` mutation | **Immutable movement ledger**, on-hand derived + cached | 1, 3, 4 |
| SW3 | P&L uses a static `monthlyProfit` seed; COGS not computed | **Weighted-average COGS** from incoming lines | 3, 6 |
| SW4 | `docNumber = random(100..900)` | Sequential counter / UUIDv7, no collisions | 1, 3 |
| SW5 | Reset reseeds memory | SQLite = source of truth, survives restart | all |
| SW6 | Picker = walk-in + quick-add only | + **live search of existing party** by name/phone | 2 |

## Styling / stack contract (every screen)

- **NativeWind `className` only.** No `StyleSheet` in app code (AGENTS.md §137, ESLint-blocked). Colors = canonical tokens from [`../design-prompts/00-style-guide.md`](../design-prompts/00-style-guide.md) in `src/theme/colors.js` + `tailwind.config.js`. Never port the web's Tailwind-v4 `bg-[#hex]` arbitrary literals.
- **RTL Arabic day one** — the web app's reading order, Arabic-Indic numerals, and ج.م currency-suffix placement are *correct*; preserve them.
- **Layered deps** `screens → hooks → repositories → db`. Screens are dumb; all reads/writes go through a repository.
- **Icons** = `@expo/vector-icons` (Feather + MaterialCommunityIcons), not emoji, not `lucide-react-native` (avoids the react-native-svg native rebuild).

## Per-step doc anatomy

Each `NN-*.md` has the same sections: **Goal · Screens delivered · Entities/schema · Key flows (port intent) · Guard-rails (never port) · Dashboard wiring · Done when · Task checklist.**

## Status

- **Step 1** spec: [`../step-1-simple-store.md`](../step-1-simple-store.md) (the detailed original) + [`01-simple-store.md`](./01-simple-store.md) (build-lens summary).
- Steps 2–8: this folder.
