# Step 5 — Expenses (النفقات)

> **Goal:** categorized expense entries (rent, salaries, utilities, fuel) that post to the cash book as cash-out and feed the OpEx line of the P&L.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `ExpensesScreen.tsx` (النفقات) | `features/expenses/screens/ExpensesScreen` | list + add expense, category, amount, date, note |
| `DirectoryModals: ExpensesModal` | `features/expenses/components/ExpenseQuickSheet` | quick-add expense from Dashboard |

## Entities / schema (see `data-model.md`)

- `expense_categories` — id, name, sort_order, + standard columns (seed: إيجار / رواتب / كهرباء ومياه / مواصلات / أخرى).
- `expenses` — id, category_id, `amount` (INTEGER minor units), date, note, optional store_id / party_id, + standard columns.
- Posting an expense writes a `cash_entry(out, source=expense, reference_id=expense.id)` — expenses appear in the cash book automatically.

## Key flows (port intent)

- Add expense → pick category → amount → date → note → save → writes expense row + cash-out entry atomically.
- Expenses list groups/filters by category + period.
- Expense total flows into P&L OpEx (Step 6).

## Guard-rails (never port from mock)

- **SW1** amount = INTEGER minor units.
- Expense → cash book link is a **posted `cash_entry`**, not a recomputed total; the cash book stays a derived ledger.
- Deleting an expense = soft-delete + reversing/removing its cash entry (never leave an orphan cash-out); prefer an undo path (target app's #2 complaint is "no undo").

## Dashboard wiring

- Feeds `أرباح الشهر` (profit shrinks by OpEx) and the cash-book running balance.

## Done when

Expenses can be categorized and recorded, appear in the cash book as cash-out, and reduce P&L profit. Correct after restart.
