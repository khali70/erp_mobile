# Supplier Debt + Cash Book — Test Cases

**Companion to:** `supplier-debt-spec.md`
**Audience:** an AI agent implementing the test suite
**Framework:** vitest, using `src/db/testing/test-db.ts` (better-sqlite3 injection), following the existing `src/repositories/document-repository.test.ts` pattern.

---

## 0. Ground rules for whoever writes these tests

- **All money is integer minor units (piasters).** 60 ج.م = `6000`. Never write a float in a test.
- **`amount` on `transactions` is always positive.** Sign lives in `direction` (+1 in, −1 out). A test that writes a negative `amount` is testing the wrong thing.
- **Nothing about debt is stored.** Never assert on `suppliers.balance`. Assert on the *derived* query. A test that passes because a cached column was updated is a test that will lie to you later.
- **Every query must exclude `deleted_at IS NOT NULL` and `status != 'posted'`.** Half the bugs in this feature will be a forgotten soft-delete or draft filter, so each derived-value test needs a sibling test that plants a deleted/draft row and proves it was ignored.
- Use fixed timestamps. Never `Date.now()` — tests that depend on the wall clock will flake on aging assertions.

### The two schema findings these cases forced

1. **Sentinel parties must be seeded, and defended.** A walk-in purchase had `party_id=null`, leaving a cash payment with nothing to point at. Fixed with seeded sentinel rows (`system-walkin-supplier`, `system-walkin-customer`, `is_system=1`) so `party_id` is never null. But an undefended sentinel is a *worse* bug than the null was — see TC-9.
2. **Daily sales figures come from `transactions`, never from `documents`.** `documents` has no `account`, so it physically cannot answer "cash vs InstaPay". See TC-6 and the split-payment case TC-4.3.

---

## TC-1 — Add new merchandise from a supplier (unpaid)

> *"I took goods from Ahmed. Paid him nothing."*

### TC-1.1 — full debt, no payment
**Given** supplier Ahmed exists
**When** a purchase document is posted: `kind='in'`, `party_id=Ahmed`, one line (item X, qty 3, unit_price 2000), `total_amount=6000`, paid = 0
**Then**
- 1 row in `documents`, 1 row in `document_lines`
- **0 rows in `transactions`** ← the critical assertion. No money moved.
- `owed(Ahmed) === 6000`
- `cash('cash')` unchanged
- `stock_levels[X].qty_on_hand` increased by 3

### TC-1.2 — debt accumulates across invoices
**Given** Ahmed has an unpaid invoice of 6000
**When** a second purchase from Ahmed is posted, total 4000, unpaid
**Then** `owed(Ahmed) === 10000` (debt is a sum over documents, not a per-invoice flag)

### TC-1.3 — debt is per-supplier, never global
**Given** Ahmed owed 6000 and Mahmoud owed 4000
**Then** `owed(Ahmed) === 6000` and `owed(Mahmoud) === 4000` — neither leaks into the other
**And** total payables === 10000

### TC-1.4 — walk-in purchase (NO supplier)
**Given** the walk-in option is chosen — "شراء نقدي مباشر (بدون مورد)"
**When** a purchase of 6000 is posted, paid 6000 in cash
**Then**
- `documents.party_id === 'system-walkin-supplier'` — **never `null`**
- the transaction is an ordinary row: `ref_kind='supplier'`, `ref_id='system-walkin-supplier'`, `direction=-1`, `account='cash'`
- `cash('cash')` decreased by 6000
- the sentinel does **not** appear in the debts report (see TC-9.3)
- **Invariant:** a walk-in purchase must be fully paid. `paid < total` on a sentinel party must be **rejected** — a sentinel must never carry debt.

### TC-1.5 — draft and soft-deleted documents create no debt
**Given** a purchase from Ahmed with `status='draft'`, and another with `deleted_at` set
**Then** `owed(Ahmed) === 0`

---

## TC-2 — Add merchandise and pay *part* of the money

> *"I took 6000 of goods from Ahmed and gave him 2000."* — the user's actual pain.

### TC-2.1 — partial payment at delivery
**Given** supplier Ahmed
**When** a purchase of `total_amount=6000` is posted with paid = 2000, account `'cash'`
**Then**
- 1 `transactions` row: `direction=-1`, `amount=2000`, `account='cash'`, `ref_kind='supplier'`, `ref_id=Ahmed`, `occurred_at = doc date`
- `owed(Ahmed) === 4000`
- `cash('cash')` decreased by 2000

### TC-2.2 — atomicity ⚠️
**Given** the payment write is made to fail (e.g. constraint violation on the transaction insert)
**Then** the document and its lines must **also** roll back — no orphan invoice with a phantom debt.
> **Implementation note:** `expo-sqlite`'s sync driver **cannot nest transactions**. `documentRepository.create()` already wraps in `db.transaction()`, so the payment insert must go *inside* that same transaction, not open its own.

### TC-2.3 — paying the rest later, from the debts screen
**Given** TC-2.1 state (`owed(Ahmed) === 4000`)
**When** a standalone transaction is recorded: `−1`, `4000`, `ref_kind='supplier'`, `ref_id=Ahmed`, dated 10 days later
**Then** `owed(Ahmed) === 0` and Ahmed no longer appears in the debts list

### TC-2.4 — paid in full at delivery → zero debt
**When** paid === total
**Then** `owed(Ahmed) === 0`, and exactly **one** transaction row exists (not zero — the money really did move, and the cash book must show it)

### TC-2.5 — overpayment produces credit, and is allowed
**Given** `owed(Ahmed) === 2500`
**When** a payment of 4000 is recorded
**Then** `owed(Ahmed) === -1500` — a **negative** balance meaning Ahmed owes *you*. Must not throw, must not clamp to 0.
**And** the debts list shows it as credit (رصيد لك), not as debt

### TC-2.6 — validation
- `paid < 0` → rejected
- `paid > total` on the purchase screen → rejected *at the form* (over-paying happens later via the debts screen, not at delivery)
- `paid === 0` → allowed, writes no transaction

### TC-2.7 — payment split across two accounts
**When** a 6000 purchase is paid 2000 cash + 1000 InstaPay
**Then** **two** transaction rows, both `ref_kind='supplier'`; `owed(Ahmed) === 3000`; `cash('cash')` −2000; `cash('instapay')` −1000

---

## TC-3 — Selling order paid in CASH

### TC-3.1 — cash sale
**When** a sale document is posted: `kind='out'`, total 10000, paid cash
**Then**
- 1 `transactions` row: `direction=+1`, `amount=10000`, `account='cash'`, `ref_kind='sale'`, `ref_id = <document id>`
- `cash('cash')` increased by 10000
- stock decreased by the line quantities

### TC-3.2 — sales must be fully settled ⚠️
Customer debt (AR) is **deprecated and not built**. There is therefore no book to hold an unpaid sale.
**Invariant:** for a sale, `Σ transactions.amount where ref_kind='sale' and ref_id=doc` **must equal** `doc.total_amount`.
A sale posted with less than full payment must be **rejected** — otherwise money silently vanishes with nowhere to record it.
> If this constraint ever proves wrong in the real shop, that is the signal that AR must be un-deprecated. It is not a bug to paper over.

---

## TC-4 — Selling order paid by INSTAPAY

### TC-4.1 — InstaPay sale
**When** a sale of 10000 is posted with account `'instapay'` and a screenshot attached
**Then**
- 1 transaction: `+1`, `10000`, `account='instapay'`, `ref_kind='sale'`, `attachments` = the screenshot metadata
- `cash('instapay')` increased by 10000
- **`cash('cash')` is UNCHANGED** ← the assertion that proves the two pockets are genuinely separate

### TC-4.2 — proof of money lives on the transaction, not the document
**Given** a purchase of 30000 paid in three installments — 10000 cash, then 10000 InstaPay (screenshot A), then 10000 InstaPay (screenshot B)
**Then** three transaction rows, each carrying **its own** `attachments`
**And** `documents.attachments` is untouched by any of it (that field is proof of *goods* — the supplier's paper invoice — not proof of *money*)
> This is the case that makes a `paid_amount` column impossible: three payments, three proofs, and a single number cannot say which proof is which.

### TC-4.3 — one sale, split across both pockets ⚠️
**When** a sale of 10000 is paid 5000 cash + 5000 InstaPay
**Then**
- **two** transaction rows, both `ref_kind='sale'` pointing at the **same** document
- `cash('cash')` +5000, `cash('instapay')` +5000
- the sale-settled invariant of TC-3.2 still holds (5000 + 5000 === 10000)
> This is exactly why the daily cash/InstaPay figures must be summed from `transactions` and not from `documents` — one document, two pockets.

---

## TC-5 — "How much do we owe suppliers?"

### TC-5.1 — the debts list
**Given** Ahmed owed 4000, Mahmoud owed 0 (fully paid), Sayed owed 1500
**Then** the list contains **exactly** Ahmed and Sayed, sorted by amount descending: `[Ahmed 4000, Sayed 1500]`. Mahmoud must not appear.

### TC-5.2 — total payables includes EXPENSES, not just suppliers ⚠️
**Given** supplier debt of 5500 **and** an unpaid rent expense of 20000
**Then** `totalPayables === 25500`
> The Home KPI (`dashboard-stats.ts:37`) currently sums only `suppliers.balance`. Even once suppliers work, it **under-reports what the owner actually owes** until expenses are included. This test is what catches that.

### TC-5.3 — partly-paid expense
**Given** a rent expense of 20000, with a 5000 payment (`ref_kind='expense'`)
**Then** `owed(expense) === 15000` and it still shows in payables

### TC-5.4 — invoice-level FIFO breakdown (derived, never stored)
**Given** Ahmed has invoice A (2500, older) and invoice B (2500, newer), and one payment of 4000
**Then** the derived breakdown reads:
- A → settled in full (2500)
- B → partial (1500), **1000 remaining**
**And** `owed(Ahmed) === 1000`
**And** there are **no allocation rows anywhere in the database** — this is computed at read time by walking invoices oldest-first against payments oldest-first.

### TC-5.5 — aging
**Given** Ahmed's oldest unpaid invoice is dated 45 days before a fixed "now"
**Then** the debts row reports an age of 45 days. Use an injected clock, never `Date.now()`.

### TC-5.6 — on-account payment (no invoice yet)
**When** 5000 is paid to Ahmed while he has **no** unpaid invoices
**Then** `owed(Ahmed) === -5000` (credit). **And** when a 3000 invoice is later posted for Ahmed, `owed(Ahmed) === -2000` — the credit absorbs it automatically, with no allocation logic.

### TC-5.7 — AP and AR never auto-net ⚠️
**Given** Ahmed exists as a supplier (you owe him 6000) **and** as a customer with the same name/phone
**Then** supplier debt reports 6000. It must **not** be silently reduced by anything on the customer side. Two books, never netted by default.

---

## TC-6 — "How much did we sell today — cash vs InstaPay?"

> The number must be summed from **`transactions`**, filtered on `occurred_at`. `documents` has no `account` column and physically cannot answer this.

### TC-6.1 — daily split
**Given** on day D: a 10000 cash sale, a 7000 InstaPay sale, and a 3000 cash sale
**Then**
- `salesToday('cash') === 13000`
- `salesToday('instapay') === 7000`
- `salesToday(total) === 20000`

### TC-6.2 — supplier payments must NOT be counted as sales
**Given** on day D: a 10000 cash sale **and** a 4000 cash payment to Ahmed
**Then** `salesToday('cash') === 10000` — filtered on `ref_kind='sale'`, so the outgoing payment is excluded
**And** `cash('cash')` net movement for the day === +6000
> Sales and cash-flow are different questions. This test is what stops them being fused.

### TC-6.3 — day boundaries
Sales at `23:59:59` on day D and `00:00:01` on day D+1 land in different buckets. Use explicit timestamps, and be explicit about the timezone (the shop is in Egypt — do **not** bucket by UTC).

### TC-6.4 — a split-paid sale lands in both buckets
**Given** TC-4.3 (one 10000 sale, 5000 cash + 5000 InstaPay)
**Then** `salesToday('cash') === 5000` and `salesToday('instapay') === 5000` — one sale, correctly counted once in each pocket.

### TC-6.5 — revenue ≠ cash collected
**Given** a sale document dated day D (`doc_date = D`) whose payment transaction is dated day D+1 (`occurred_at = D+1`)
**Then** `salesToday('cash')` on day D === 0, and on day D+1 === the amount.
> The cash book follows the **money** (`occurred_at`), not the paperwork (`doc_date`). Under TC-3.2 this shouldn't happen in production — but the test pins the semantics so nobody "helpfully" reports the daily figure off `documents` later.

---

## TC-7 — Cash book integrity (the ones that stop the owner abandoning the app)

### TC-7.1 — owner drawing
**When** the owner takes 2000 from the drawer (`ref_kind='owner'`, `direction=-1`, `ref_id=null`)
**Then** `cash('cash')` −2000, and **no** supplier debt anywhere changes.
> If this movement cannot be recorded, the app's cash figure stops matching the physical drawer — and the day it stops matching is the day the owner stops trusting the app.

### TC-7.2 — transfer nets to zero
**When** 5000 moves drawer → InstaPay: **two** rows, `ref_kind='transfer'` — (`−1`, 5000, `cash`) and (`+1`, 5000, `instapay`)
**Then** `cash('cash')` −5000, `cash('instapay')` +5000, and **total cash across all accounts is UNCHANGED**.
> A transfer is not income and not an expense. Get this wrong and every transfer looks like a loss.

### TC-7.3 — reconciliation invariant
For any dataset: `Σ(direction × amount) per account === cash(account)`. Property-test it against a randomized transaction set.

### TC-7.4 — soft-deleted transactions vanish from every figure
A transaction with `deleted_at` set must not affect debt, cash, or the daily sales split.

---

## TC-9 — Sentinel parties (`is_system`) ⚠️

> A sentinel that isn't defended is worse than the null it replaced. Every one of these is a real failure mode, not a formality.

### TC-9.1 — seeded, and seeding is idempotent
**When** `migrate.ts` runs twice (fresh install, then an app restart)
**Then** exactly **one** `system-walkin-supplier` and **one** `system-walkin-customer` exist, both `is_system=1`, `balance=0`. Seeding must be `INSERT OR IGNORE` on a fixed id — a duplicate sentinel silently splits walk-in history in two.

### TC-9.2 — hidden from the party lists
**Then** `supplierRepository.list()` and `customerRepository.list()` **exclude** `is_system=1` rows. The owner must never see "نقدي (بدون مورد)" sitting in his supplier list as if it were a real person.

### TC-9.3 — excluded from debt, always
**Given** a walk-in purchase somehow recorded as underpaid (data predating the invariant, or an import)
**Then** the sentinel appears **nowhere** in the debts list, and `totalPayables` **excludes** it.
> Without this, the owner's payables KPI reads *"بدون مورد owes you 500"* — a debt to nobody, and a number he cannot act on or reconcile.

### TC-9.4 — undeletable, unarchivable, uneditable ⚠️
**When** `update()` / `archive()` is called on an `is_system=1` party
**Then** it is **rejected**.
> This is the catastrophic one. Archive the sentinel and **every walk-in document in history orphans** — its `party_id` points at a soft-deleted row, and every join silently drops those documents from reports.

### TC-9.5 — still fully visible in the cash book
**Then** walk-in transactions **do** appear in the cash book and **do** move `cash('cash')`.
> The money genuinely left the drawer. Debt hides the sentinel; cash must never hide anything. A cash book with a hole in it is worse than no cash book.

### TC-9.6 — migration backfills existing nulls
**Given** a pre-existing DB with `kind='in'` documents at `party_id = null`, and `kind='out'` documents at `party_id = null`
**When** the migration runs
**Then** the purchases repoint at `system-walkin-supplier`, the sales at `system-walkin-customer`, and **no document is left with a null `party_id`**.

### TC-9.7 — the sentinel is not a real party in any count
`supplierRepository.count()` and the Suppliers-list empty-state must both ignore `is_system=1` — a shop with zero real suppliers must still read as empty, not as "1 supplier".

---

## TC-8 — Suggested test file layout

```
src/repositories/transaction-repository.test.ts   TC-4.*, TC-7.*
src/repositories/expense-repository.test.ts       TC-5.3
src/repositories/supplier-repository.test.ts      TC-9.* (sentinel guards)
src/db/migrate.test.ts                            TC-9.1 idempotent seed, TC-9.6 backfill
src/repositories/debt-repository.test.ts          TC-1.*, TC-2.*, TC-5.*   ← the important one
src/repositories/document-repository.test.ts      extend: TC-2.2 atomicity, TC-3.2 sale invariant
src/features/reports/debts.test.ts                TC-5.4 FIFO walk, TC-5.5 aging
src/features/cashbook/cashbook.test.ts            TC-6.*
```

**If you only write four of these, write TC-2.2 (atomicity), TC-5.4 (the FIFO walk), TC-7.3 (reconciliation), and TC-9.4 (the sentinel is undeletable).** Those are the four that fail *silently* and corrupt the owner's trust, rather than throwing an error he can see.
