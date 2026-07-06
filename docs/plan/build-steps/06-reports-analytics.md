# Step 6 — Reports & Analytics (التقارير)

> **Goal:** the full report suite — read models over Steps 1–5 data. Headline = **Profit & Loss** computed from the ledger + weighted-average COGS. No new write entities.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `ReportsScreen.tsx` (التقارير) | `features/reports/screens/ReportsListScreen` + per-report screens | report catalog, favoritable, period tabs (today/week/month/year) |
| P&L view inside `ReportsScreen` | `features/reports/screens/ProfitLossScreen` | Revenue → COGS → Operating profit → OpEx → Net; handles losses |
| `DocumentsScreen.tsx` (المستندات) | `features/documents/screens/DocumentsListScreen` | all posted docs, filter, detail |

## Reports to deliver (from observed target app + web mock)

Financial: **P&L**, Cash book (Step 3 screen, report view), **Debts by customer (AR)**, **Debts by supplier (AP)**.
Purchases: by item, by supplier. Sales: by item, by date, by customer, by month.
Operational: Stock movement, Documents list, Transactions list.

## Entities / schema

- **None** — reports are query views / read models over `documents`, `document_lines`, `stock_levels`, `party_transactions`, `cash_entries`, `expenses`. Add SQL views or repository query methods; no new tables.

## Key flows (port intent)

- Report catalog with shared **date-range + store + party** filter controls.
- **P&L structure (port the intent — it's correct):** Revenue (Σ sales) → **COGS** → Operating profit → OpEx (Σ expenses) → Net; correct negative/loss handling.
- Each report exportable (CSV / PDF share sheet).

## Guard-rails (never port from mock)

- **SW3** COGS = **weighted-average** cost from incoming lines (`avg_cost` per item), computed from the ledger — the mock's `monthlyProfit` is a static seed and its COGS isn't computed. Do the real math.
- **SW1** all money INTEGER minor units; format only at render.
- Every report must **match hand-computed spot checks** against the raw ledger — a report that disagrees with `SELECT Σ` on the source rows is wrong.
- Reports are **read-only** — never mutate source data to make a total balance.

### Debt aging (beat the target app — UX gap #3)

AR/AP reports add **aging buckets** (0–30 / 30–60 / 60+ days) from `party_transactions.created_at`. The target app and the web mock both show only a single balance — buckets are a cheap differentiator and a real cash-flow tool.

## Dashboard wiring

- All KPI cards now read from the same query layer these reports use — single source of truth for every number the owner sees.

## Done when

Every report renders from local data with working filters, P&L computes COGS from weighted-average cost, AR/AP show aging buckets, and every total matches a hand-computed spot check. Correct after restart.
