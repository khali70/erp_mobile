# دفتر النقدية — Cash Book Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
One ledger holding **every movement of money**, in or out, with no exceptions — sales collected, supplier payments, bills, owner drawings and injections, and transfers between the drawer and InstaPay. Answers the two questions the owner actually asks: *"does the app agree with what is in my drawer?"* and *"how much did I sell today, cash versus InstaPay?"*

## UX
- **Two balances, never merged**: نقدي and إنستاباي are separate cards. Each reconciles against something real — a drawer you can count, an app you can open. A single combined figure can be checked against nothing.
- **مبيعات اليوم**: today's takings, split by pocket. Summed from `transactions` (`ref_kind='sale'`, filtered on `occurred_at`) — **never** from `documents`, which has no `account` column and cannot say which pocket a sale landed in. For a split-paid sale, the answer is *both*.
- Rows grouped by day (the shop's LOCAL timezone, never UTC), newest first. Each row says **why** the money moved — a bare list of amounts is a bank statement, and nobody can reconcile a bank statement against his memory of the day.
- A **transfer renders as ONE row** (نقدي ← إنستاباي) with no + or −: it is the same money in another pocket, neither income nor expense.
- **تسجيل حركة** sheet records what no other screen can: drawings, injections, transfers, and an `'other'` escape hatch.

## Navigation
- **In**: Home «دفتر النقدية» tile.
- **Out**: the record-movement sheet.

## Why needed
Cash is the owner's daily reality. **A cash book with a hole in it is worse than no cash book**: the day its figure stops matching the physical drawer is the day he stops trusting the app. So the owner grabbing 200 for lunch has to be recordable — which is what `owner`, `transfer` and `other` exist for.

## Guard-rails
- Balances and daily figures are **DERIVED** — `Σ(direction × amount)` per account, recomputed on every read. No stored balance and nothing cached, so no figure can disagree with the ledger beneath it: it *is* the ledger.
- Money is integer minor units; `amount` is always positive and the sign lives in `direction`.
- Soft-deleted transactions affect **nothing** — not cash, not debt, not the daily split.
- Walk-in (sentinel) money is fully visible here. Debt hides the sentinel; **cash hides nothing**.
