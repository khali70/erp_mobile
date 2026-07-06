# النفقات — Expenses Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 5.

## Purpose
Record shop operating costs that aren't stock purchases — rent, salaries, fuel, utilities. Feeds the cash book and the P&L operating-expense line.

## UX
- List of expenses: date, category, amount, note.
- ＋ add: category (rent/salary/fuel/other), amount, date, optional note.
- Grouped/summed by month for quick review.

## Navigation
- **In**: Home tile «النفقات».
- **Out**: back to Home; drills to Cash Book / P&L context.

## Why needed
Profit isn't revenue minus COGS alone — OpEx eats margin. Without expenses the P&L lies. Also a top complaint in the target app (expenses buggy), so getting this right is a differentiator.

## Locked feedback (2026-07-07 — owner)
- **Speed** — add expense is a **FAB → tiny sheet** (category chip + amount + optional note), amount field auto-focused with numeric keypad. Two taps + a number, done.
- **Month-total card** on top (danger/red accent) with last-month compare, per screenshot.
- **Category chips** filter row: الكل / إيجار / رواتب / كهرباء / نقل.
- **Never lose data** — same draft-autosave rule as the document screens if the add-sheet grows multi-field.

## Guard-rails
Integer minor units. Each expense posts a cash-out movement to the cash book. No float.
