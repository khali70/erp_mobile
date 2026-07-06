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

## Guard-rails
Integer minor units. Each expense posts a cash-out movement to the cash book. No float.
