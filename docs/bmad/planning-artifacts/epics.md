---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - docs/bmad/brainstorming/brainstorm-supplier-debt-2026-07-14/supplier-debt-spec.md
  - docs/bmad/brainstorming/brainstorm-supplier-debt-2026-07-14/supplier-debt-test-cases.md
  - docs/bmad/brainstorming/brainstorm-supplier-debt-2026-07-14/.memlog.md
---

# ERP Mobile — Supplier Debt (AP) + Cash Book — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Supplier Debt (Accounts Payable) + Cash Book feature, decomposing requirements from the **design spec** and **test-cases doc** (which stand in for a PRD + Architecture pair — they are more concrete than either).

**Core design (settled, not to be re-litigated):**

> **Debt was never missing from the database. Only the payment was.** A posted purchase document with a `party_id` already *is* the event "I took goods from Ahmed." Two new tables (`transactions`, `expenses`) plus derived queries turn that latent data into a working AP + cash book, and light up six screens that are currently stubs or dead UI.

Every acceptance criterion below is mapped to a **TC-\*** id from `supplier-debt-test-cases.md`, so the dev agent can verify against a pre-written test contract.

## Requirements Inventory

### Functional Requirements

```
FR1:  Record a purchase invoice against a supplier, capturing how much was paid at delivery.
FR2:  The paid field DEFAULTS to the full invoice total (the shop rarely buys on debt — debt is the exception).
FR3:  Accept partial payment (0 < paid < total); the remainder automatically becomes supplier debt.
FR4:  Accept zero payment (paid = 0); the full invoice becomes debt and NO transaction row is written.
FR5:  Record a payment to a supplier later, after the invoice is closed, from the debts screen.
FR6:  Every payment records which account it moved through: cash OR InstaPay.
FR7:  Attach payment proof (InstaPay screenshot) to the PAYMENT, not to the document. Proof field appears only for InstaPay.
FR8:  List all suppliers with outstanding debt, sorted by amount owed descending; suppliers at zero do not appear.
FR9:  Show a supplier's debt detail: their invoices with a derived FIFO breakdown (which invoice each payment settled), plus payment history.
FR10: Show the age of the oldest unpaid debt per supplier (aging).
FR11: Allow overpayment — paying more than owed yields a negative balance (credit, رصيد لك), never an error and never clamped to zero.
FR12: Expenses become real persisted data (currently DEMO_EXPENSES mock): create, list, archive.
FR13: Record payments against an expense; an unpaid expense is debt exactly like a supplier invoice.
FR14: Total payables = supplier debt + unpaid expenses. The Home KPI must include BOTH (today it counts only suppliers).
FR15: Cash Book screen: a real in/out ledger of every money movement, ordered by date.
FR16: Record owner drawings and capital injections (money leaving/entering the drawer for non-business reasons).
FR17: Record transfers between accounts (drawer ↔ InstaPay) as two rows netting to zero total cash.
FR18: Report the day's sales split by account: how much sold in cash, how much via InstaPay.
FR19: Record sale payments (cash, InstaPay, or SPLIT across both — one document, two transaction rows).
FR20: Seed sentinel parties (walk-in supplier + walk-in customer) so party_id is never null.
FR21: Defend the sentinels: hidden from party lists and counts, undeletable/unarchivable/uneditable, excluded from all debt figures, but fully visible in the cash book.
FR22: Re-enable the `withDebt` filter chip on the Suppliers list (currently commented out because it always matched nothing).
FR23: DebtBadge and the `prevDebt` line on PartyCard must render real values (both are already coded and currently never fire).
FR24: Record cash sales and InstaPay sales with proof attachment, mirroring the purchase payment flow.
```

### NonFunctional Requirements

```
NFR1:  Offline-first. No network, no REST backend. All state is local expo-sqlite via Drizzle.
NFR2:  All money is INTEGER minor units (piasters). Never a float, anywhere, including in tests.
NFR3:  Debt is DERIVED, never stored. `suppliers.balance` is retired — no code may read or write it.
       A derived number cannot disagree with the invoices, because it IS the invoices.
NFR4:  Every derived query MUST exclude soft-deleted rows (`deleted_at IS NOT NULL`) and non-posted
       documents (`status != 'posted'`). This is the most likely source of silent wrong numbers.
NFR5:  Atomicity: the payment row must be written inside the SAME db transaction as the document + lines.
       expo-sqlite's sync driver CANNOT nest transactions — the payment insert must go inside
       documentRepository.create()'s existing db.transaction(), not open its own.
NFR6:  AP and AR are separate books and are NEVER auto-netted, even for a party who is both
       supplier and customer.
NFR7:  Arabic-first RTL UI, with ar + en i18n parity. New namespaces: debts, cashbook, payments.
NFR8:  Derived queries must be fast at shop scale (a handful of suppliers, debt is rare). Cache ONLY
       if proven slow, and only as a cache.
NFR9:  Migrations and the sentinel seed must be IDEMPOTENT — they run on every app boot.
NFR10: The cash book must be COMPLETE. Every money movement is recordable, including owner drawings
       and transfers. A cash book with a hole in it is worse than no cash book: the day the app's
       figure stops matching the physical drawer is the day the owner stops trusting the app.
NFR11: Reconciliation invariant: Σ(direction × amount) per account === that account's balance, always.
NFR12: Money and paperwork are different clocks. Cash figures follow `transactions.occurred_at`;
       revenue follows `documents.doc_date`. Daily cash/InstaPay splits MUST come from transactions —
       `documents` has no `account` column and physically cannot answer "which pocket".
```

### Additional Requirements

From the existing codebase (these are hard constraints, not preferences):

```
- Migrations are HAND-WRITTEN in src/db/migrate.ts, NOT Drizzle-generated. `drizzle-kit generate` is
  wired in package.json but src/db/migrations/ does not exist and has never been used. Every new table
  needs edits in TWO places: (a) the CREATE TABLE IF NOT EXISTS boot blob, (b) an addColumnIfMissing
  line for the upgrade path.
- Complex repositories use the factory + `.client.ts` singleton pattern (see document-repository.ts /
  document-repository.client.ts) so tests can inject better-sqlite3. New repos must follow it.
- Feature-first structure: src/features/<feature>/{screens,components,hooks}; shared UI in
  src/components/ui; data access ONLY in src/repositories; only src/db and src/repositories may
  import the db client.
- Tests use vitest with src/db/testing/test-db.ts, following src/repositories/document-repository.test.ts.
- Polymorphic FKs are untyped and unconstrained, resolved by a sibling `kind` column — house convention,
  already used by documents.party_id.
- Existing data MUST be migrated: every document with party_id IS NULL gets repointed at the matching
  sentinel party.
- Styling via NativeWind tokens; no ad-hoc colors.
```

### UX Design Requirements

```
UX-DR1: NewIncomingScreen summary footer (the gap in the user's screenshot — it currently shows only
        عدد الأصناف and الإجمالي) gains a payment card: المدفوع (defaulting to the full total),
        الحساب toggle (نقدي | إنستاباي), إثبات الدفع image picker (shown ONLY when إنستاباي),
        and المتبقي (دين) shown only when > 0.
UX-DR2: A reusable سداد (settle) bottom sheet: amount, account toggle, date, conditional proof
        attachment, note. Used by both the debts screen and the expenses screen.
UX-DR3: DebtsBySupplierScreen list (replacing the 6-line UnderConstruction stub): row shows supplier
        name, phone, total owed, and age of oldest debt. Empty state when nobody is owed.
UX-DR4: SupplierDebtDetailScreen (new): the supplier's invoices with the derived FIFO settlement
        breakdown, their payment history, and a سداد button.
UX-DR5: CashBookScreen (replacing its stub): in/out ledger grouped by day, per-account running
        balances (cash + InstaPay shown separately), each row showing why the money moved.
UX-DR6: ExpensesScreen: replace DEMO_EXPENSES with real data; add expense create form; show
        paid/unpaid state and a سداد action.
UX-DR7: SuppliersListScreen: uncomment the `withDebt` filter chip (i18n key suppliers.filters.withDebt
        already exists in ar + en). DebtBadge starts rendering.
UX-DR8: PartyCard's `prevDebt` line ("مديونية سابقة للمورد علينا") — already coded, currently never
        renders — must show the supplier's outstanding debt when picking them on a purchase.
UX-DR9: Home dashboard KPI: supplierDebt stops always reading 0, and is corrected to count expenses too.
UX-DR10: Sale screen (NewOutgoingScreen): payment card mirroring UX-DR1, supporting a SPLIT payment
        (part cash, part InstaPay) since a sale must always be fully settled.
UX-DR11: All new copy in ar + en. New i18n namespaces: debts, cashbook, payments. The stub screens
        currently hardcode Arabic titles — that must not be repeated.
```

### FR Coverage Map

```
FR1:  Epic 1 — purchase invoice records what was paid
FR2:  Epic 1 — paid defaults to full total
FR3:  Epic 1 — partial payment leaves debt
FR4:  Epic 1 — zero payment writes no transaction
FR6:  Epic 1 — cash | InstaPay account on payment
FR7:  Epic 1 — payment proof on the transaction
FR20: Epic 1 — sentinel parties seeded
FR21: Epic 1 — sentinel guards
FR22: Epic 1 — withDebt chip re-enabled
FR23: Epic 1 — DebtBadge + PartyCard prevDebt render

FR5:  Epic 2 — pay a supplier later, from the debts screen
FR8:  Epic 2 — debts-by-supplier list
FR9:  Epic 2 — debt detail + derived FIFO breakdown
FR10: Epic 2 — aging
FR11: Epic 2 — overpayment becomes credit

FR12: Epic 3 — expenses become real data
FR13: Epic 3 — pay an expense
FR14: Epic 3 — total payables = suppliers + expenses (Home KPI corrected)

FR15: Epic 4 — cash book ledger
FR16: Epic 4 — owner drawings / injections
FR17: Epic 4 — transfers between accounts
FR18: Epic 4 — daily sales split by account
FR19: Epic 4 — sale payments (incl. split across both accounts)
FR24: Epic 4 — cash + InstaPay sales with proof
```

## Epic List

### Epic 1: Record What I Paid the Supplier (and owe the rest)
The owner posts a purchase invoice and records how much he actually handed over — cash or InstaPay, with proof. Whatever he didn't pay becomes real, visible debt. This closes the exact gap in the screenshot: the summary footer that shows only عدد الأصناف and الإجمالي gains a payment card.

**Delivers standalone value:** debt exists and is visible on the Suppliers list (DebtBadge, the withDebt chip, PartyCard's مديونية سابقة line) — all three are already coded and have never once rendered, because they read a column nothing writes.

**Carries the foundation** (the `transactions` table, sentinel parties, derived-debt query) *inside* a user-visible outcome, rather than as a valueless "database setup" epic.

**FRs covered:** FR1, FR2, FR3, FR4, FR6, FR7, FR20, FR21, FR22, FR23
**Verifies against:** TC-1.\*, TC-2.\*, TC-9.\*

### Epic 2: Know What I Owe Each Supplier, and Settle It
The owner opens ديون الموردين and sees exactly who he owes, how much, and how long it's been outstanding. He taps a supplier, sees which invoices are still open, and pays — from the debts screen, days after the invoice closed.

**Delivers standalone value:** replaces the 6-line `UnderConstruction` stub with the feature the shop actually needs. Depends on Epic 1's transactions table; nothing after it is required for it to work.

**FRs covered:** FR5, FR8, FR9, FR10, FR11
**Verifies against:** TC-2.3, TC-2.5, TC-5.\*

### Epic 3: Rent and Bills Are Debt Too
Expenses stop being `DEMO_EXPENSES` mock data. Rent, electricity, and repairs become real, persisted obligations that the owner can pay down — and, critically, that count toward what he owes.

**Delivers standalone value:** the Home payables KPI stops under-reporting. Until this lands it counts only suppliers, so an owner with 20,000 of unpaid rent sees none of it.

**FRs covered:** FR12, FR13, FR14
**Verifies against:** TC-5.2, TC-5.3

### Epic 4: The Complete Money Picture
Every movement of money — sales in, payments out, owner drawings, transfers between the drawer and InstaPay — lands in one ledger. The owner can answer "how much did I sell today, cash versus InstaPay" and reconcile the physical drawer against the app.

**Delivers standalone value:** replaces the CashBookScreen stub. **This epic is what makes the app trustworthy** — a cash book with a hole in it is worse than no cash book, and the day the number stops matching the drawer is the day the owner stops using it.

**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR24
**Verifies against:** TC-3.\*, TC-4.\*, TC-6.\*, TC-7.\*

---

**Sequencing rationale:** Epic 1 lands the `transactions` table and the derived-debt query, so Epics 2–4 all read from data that already exists. Epics 2, 3, and 4 are independent of each other and could be built in any order.

**Known file overlap (accepted):** Epic 1 and Epic 4 both touch `useDocumentForm.ts` and `documentRepository.create()` — Epic 1 for the purchase payment, Epic 4 for the sale payment. This is the same component end-to-end, so Epic 4's story ordering must assume Epic 1's payment plumbing already exists and extend it rather than rebuild it.

---

## Epic 1: Record What I Paid the Supplier (and owe the rest)

The owner posts a purchase invoice and records how much he actually handed over. Whatever he didn't pay becomes real, visible debt across the app. This closes the gap in the screenshot.

**Foundation carried by this epic:** the `transactions` table, the derived `owed()` query, and the sentinel parties. They ride inside user-visible outcomes rather than in a valueless "set up the database" story.

### Story 1.1: Pay the supplier in full at delivery

As a **shop owner**,
I want the purchase screen to record that I paid the supplier in full when the goods arrived,
So that the money leaving my drawer is captured and I am not shown a debt I do not have.

**Acceptance Criteria:**

**Given** the `transactions` table does not exist yet
**When** this story is implemented
**Then** `src/db/schema.ts` defines `transactions` (`direction`, `amount`, `occurred_at`, `account`, `ref_kind`, `ref_id`, `note`, `attachments`, plus the standard `id`/`created_at`/`updated_at`/`deleted_at`)
**And** `src/db/migrate.ts` is edited in BOTH places — the `CREATE TABLE IF NOT EXISTS` boot blob AND an `addColumnIfMissing` upgrade path
**And** indexes exist on `(ref_kind, ref_id)`, `(occurred_at)`, and `(account)`
**And** `transactionRepository` follows the factory + `.client.ts` singleton pattern used by `document-repository.ts`

**Given** supplier Ahmed and a purchase totalling 6000 (minor units)
**When** the owner saves the invoice with المدفوع left at its default
**Then** المدفوع defaults to the FULL total (6000) — debt is the exception in this shop, so the common path requires zero extra input *(FR2)*
**And** exactly ONE `transactions` row is written: `direction=-1`, `amount=6000`, `account='cash'`, `ref_kind='supplier'`, `ref_id=Ahmed`, `occurred_at` = the document date
**And** `owed(Ahmed) === 0`
**Verifies:** TC-2.4

**Given** the payment insert is made to fail
**When** the invoice is saved
**Then** the document AND its lines roll back — no orphan invoice with a phantom debt
**And** the payment insert runs INSIDE `documentRepository.create()`'s existing `db.transaction()`, NOT in a nested one (expo-sqlite's sync driver cannot nest transactions — a nested call will throw)
**Verifies:** TC-2.2 *(NFR5)*

**Given** any purchase
**When** validation runs
**Then** `paid < 0` is rejected, and `paid > total` is rejected at the form (over-paying happens later, from the debts screen)
**Verifies:** TC-2.6

### Story 1.2: Pay only part of it — the rest becomes debt

As a **shop owner**,
I want to record that I gave the supplier less than the full amount,
So that I can see exactly what I still owe him.

**Acceptance Criteria:**

**Given** supplier Ahmed and a purchase totalling 6000
**When** the owner sets المدفوع to 2000 and saves
**Then** one `transactions` row is written for 2000
**And** `owed(Ahmed) === 4000`
**And** the summary footer shows **المتبقي (دين)** — visible only when greater than zero
**Verifies:** TC-2.1 *(FR3, UX-DR1)*

**Given** supplier Ahmed and a purchase totalling 6000
**When** the owner sets المدفوع to 0 and saves
**Then** **NO** `transactions` row is written — no money moved, so the cash book must not claim otherwise
**And** `owed(Ahmed) === 6000`
**Verifies:** TC-1.1 *(FR4)*

**Given** a derived-debt query
**When** it runs
**Then** it EXCLUDES soft-deleted rows (`deleted_at IS NOT NULL`) and non-posted documents (`status != 'posted'`)
**And** `suppliers.balance` is neither read nor written by any code path — debt is derived, never stored
**Verifies:** TC-1.5 *(NFR3, NFR4)*

**Given** Ahmed has two unpaid invoices of 6000 and 4000, and Mahmoud has one of 4000
**When** debt is computed
**Then** `owed(Ahmed) === 10000` and `owed(Mahmoud) === 4000` — neither leaks into the other
**Verifies:** TC-1.2, TC-1.3

### Story 1.3: Buy without naming a supplier (walk-in)

As a **shop owner**,
I want to buy goods for cash without registering the seller as a supplier,
So that quick one-off purchases still leave a correct trail in my cash book.

**Acceptance Criteria:**

**Given** `documents.party_id` is currently `null` for walk-in purchases, leaving a cash payment with nothing to point at
**When** this story is implemented
**Then** `suppliers` and `customers` both gain an `is_system` column (integer, default 0)
**And** `migrate.ts` seeds `system-walkin-supplier` ("نقدي (بدون مورد)") and `system-walkin-customer` ("نقدي (بدون زبون)") via `INSERT OR IGNORE` on a fixed id, so re-running on every boot creates no duplicates
**And** the migration BACKFILLS every existing `party_id IS NULL` document to the matching sentinel — no document is left with a null party
**Verifies:** TC-9.1, TC-9.6 *(FR20, NFR9)*

**Given** the walk-in option ("شراء نقدي مباشر (بدون مورد)") is chosen
**When** a purchase of 6000 is saved, paid 6000 cash
**Then** `documents.party_id === 'system-walkin-supplier'` — never `null`
**And** the payment is an ordinary `ref_kind='supplier'` transaction pointing at the sentinel
**And** a walk-in purchase with `paid < total` is REJECTED — a sentinel must never carry debt
**Verifies:** TC-1.4

**Given** the sentinels exist
**When** the app runs
**Then** `supplierRepository.list()` and `count()` EXCLUDE `is_system=1` — the owner never sees "نقدي (بدون مورد)" sitting in his supplier list
**And** `update()` and `archive()` REJECT `is_system=1` — archiving the sentinel would orphan every walk-in document in history, silently dropping them from every report
**And** the sentinel appears NOWHERE in the debts list and is excluded from `totalPayables`
**And** walk-in transactions DO appear in the cash book and DO move the cash balance — debt hides the sentinel, cash hides nothing
**Verifies:** TC-9.2, TC-9.3, TC-9.4, TC-9.5, TC-9.7 *(FR21, NFR10)*

### Story 1.4: Pay by InstaPay and keep the proof

As a **shop owner**,
I want to record that I paid by InstaPay and attach the screenshot,
So that I can prove the payment later, and so my drawer and my InstaPay balance each reconcile on their own.

**Acceptance Criteria:**

**Given** the payment card on the purchase screen
**When** the owner picks الحساب
**Then** he chooses **نقدي** or **إنستاباي**
**And** the **إثبات الدفع** image picker appears ONLY for إنستاباي — cash needs no proof, both men saw the money change hands
**Verifies:** UX-DR1 *(FR6, FR7)*

**Given** a purchase of 10000 paid by InstaPay with a screenshot
**When** it is saved
**Then** the transaction carries `account='instapay'` and its OWN `attachments` — the proof lives on the PAYMENT, not the document
**And** `cash('instapay')` decreases by 10000 while **`cash('cash')` is UNCHANGED** — the two pockets are genuinely separate
**Verifies:** TC-4.1

**Given** a purchase of 30000 paid in three installments — 10000 cash, then 10000 InstaPay (screenshot A), then 10000 InstaPay (screenshot B)
**When** the payments are recorded
**Then** three transaction rows exist, each carrying its OWN attachment
**And** `documents.attachments` is untouched by any of them — that field is proof of GOODS (the supplier's paper invoice); `transactions.attachments` is proof of MONEY
**Verifies:** TC-4.2

**Given** a purchase of 6000 paid 2000 cash + 1000 InstaPay
**When** it is saved
**Then** TWO transaction rows are written, both `ref_kind='supplier'`; `owed(Ahmed) === 3000`; cash −2000; instapay −1000
**Verifies:** TC-2.7

### Story 1.5: See supplier debt everywhere it was already promised

As a **shop owner**,
I want the debt figures the app already shows me to finally be real,
So that I can trust what I am looking at.

**Acceptance Criteria:**

**Given** `DebtBadge`, the `withDebt` filter chip, and `PartyCard`'s `prevDebt` line are ALL already coded but have never once rendered (they read `suppliers.balance`, which nothing writes)
**When** this story is implemented
**Then** all three read the DERIVED `owed()` value instead
**And** the `withDebt` chip in `SuppliersListScreen.tsx` is UNCOMMENTED (i18n key `suppliers.filters.withDebt` — "عليهم ديون" — already exists in ar and en)
**And** `DebtBadge` renders for suppliers with debt
**And** `PartyCard`'s "مديونية سابقة للمورد علينا" line renders when picking a supplier who is already owed money
**Verifies:** *(FR22, FR23, UX-DR7, UX-DR8)*

**Given** the Home dashboard KPI `supplierDebt` (`dashboard-stats.ts:37`) currently sums `suppliers.balance` and therefore always reads 0
**When** this story is implemented
**Then** it sums the derived supplier debt and shows a real number
**And** it is left structured so Epic 3 can add expenses to it without a rewrite
**Verifies:** *(UX-DR9)*

**Given** all new copy
**When** it is added
**Then** it goes through i18n in BOTH ar and en — new namespaces `debts` and `payments`. The stub screens currently hardcode Arabic titles; that must not be repeated.
**Verifies:** *(NFR7, UX-DR11)*

---

## Epic 2: Know What I Owe Each Supplier, and Settle It

The owner opens ديون الموردين, sees who he owes and for how long, and pays them — days after the invoice closed.

### Story 2.1: See who I owe, worst first

As a **shop owner**,
I want a list of every supplier I owe money to, biggest debt first,
So that I know who to pay next and who I can look in the eye.

**Acceptance Criteria:**

**Given** `DebtsBySupplierScreen.tsx` is a 6-line `UnderConstruction` stub
**When** this story is implemented
**Then** it renders a real list of suppliers where `owed(S) > 0`, sorted by amount owed DESCENDING
**And** each row shows: name, phone, total owed, and the age of the oldest unpaid debt
**And** a supplier who is fully paid does NOT appear
**And** an empty state shows when nobody is owed
**Verifies:** TC-5.1 *(FR8, UX-DR3)*

**Given** Ahmed's oldest unpaid invoice is dated 45 days before "now"
**When** the list renders
**Then** his row reports an age of 45 days
**And** the aging calculation uses an INJECTED clock, never `Date.now()` — otherwise the tests flake
**Verifies:** TC-5.5 *(FR10)*

**Given** the sentinel walk-in supplier
**When** the list renders
**Then** it never appears, even if a legacy record left it holding a balance
**Verifies:** TC-9.3

### Story 2.2: See which of a supplier's invoices are still open

As a **shop owner**,
I want to tap a supplier and see exactly which invoices my payments covered and what is left,
So that I can settle an argument with him using the app instead of my memory.

**Acceptance Criteria:**

**Given** Ahmed has invoice A (2500, older) and invoice B (2500, newer), and one payment of 4000
**When** the owner opens Ahmed's detail screen
**Then** the derived breakdown reads: **A → settled in full (2500)**, **B → partial (1500), 1000 remaining**
**And** `owed(Ahmed) === 1000`
**And** there are **NO allocation rows anywhere in the database** — this is computed at read time by walking invoices oldest-first against payments oldest-first
**Verifies:** TC-5.4 *(FR9, UX-DR4)*

**Given** the FIFO walk
**When** it runs
**Then** it is deterministic — there is no manual invoice-picking anywhere in the UI, so no user action can contradict it
**And** the owner never sees the word "allocation"; he sees *"IN-000012 · سُدّدت بالكامل"*

**Given** the detail screen
**When** it renders
**Then** it also shows the supplier's payment history (date, amount, account, and any proof attachment)

### Story 2.3: Pay a supplier days later

As a **shop owner**,
I want to record a payment to a supplier long after the invoice is closed,
So that his debt goes down when I actually pay him, not only when I buy.

**Acceptance Criteria:**

**Given** `owed(Ahmed) === 4000`
**When** the owner taps سداد and records 4000, account نقدي, dated 10 days after the invoice
**Then** one standalone `transactions` row is written — `ref_kind='supplier'`, `ref_id=Ahmed` — with NO document involved
**And** `owed(Ahmed) === 0` and Ahmed disappears from the debts list
**Verifies:** TC-2.3 *(FR5)*

**Given** the سداد sheet
**When** it opens
**Then** it collects: المبلغ, الحساب (نقدي | إنستاباي), التاريخ, إثبات الدفع (shown ONLY for إنستاباي), ملاحظة
**And** it is built as a REUSABLE component — Epic 3 will use the same sheet to pay an expense
**Verifies:** *(UX-DR2)*

### Story 2.4: Overpay a supplier and hold the credit

As a **shop owner**,
I want to hand a supplier more than I owe him and have the app remember he owes me the difference,
So that a round-number payment or a deposit is not something the app refuses.

**Acceptance Criteria:**

**Given** `owed(Ahmed) === 2500`
**When** the owner records a payment of 4000
**Then** `owed(Ahmed) === -1500` — a NEGATIVE balance, meaning Ahmed owes *him*
**And** it does NOT throw and is NOT clamped to zero
**And** the UI presents it as credit (رصيد لك), not as debt
**Verifies:** TC-2.5 *(FR11)*

**Given** Ahmed has NO unpaid invoices
**When** 5000 is paid to him on account
**Then** `owed(Ahmed) === -5000`
**And** when a 3000 invoice is later posted for Ahmed, `owed(Ahmed) === -2000` — the credit absorbs it automatically, with no allocation logic
**Verifies:** TC-5.6

**Given** Ahmed exists as a supplier (owed 6000) and also as a customer
**When** debt is computed
**Then** the supplier figure is 6000 and is NOT silently reduced by anything on the customer side — AP and AR are separate books, never auto-netted
**Verifies:** TC-5.7 *(NFR6)*

---

## Epic 3: Rent and Bills Are Debt Too

Expenses stop being mock data. Rent, electricity, and repairs become real obligations that count toward what the owner owes.

### Story 3.1: My expenses are real and they persist

As a **shop owner**,
I want my rent and bills saved properly instead of being a demo list,
So that they survive closing the app and can be paid down.

**Acceptance Criteria:**

**Given** `ExpensesScreen` currently renders from `DEMO_EXPENSES` in `src/features/expenses/data.ts` and no `expenses` table exists
**When** this story is implemented
**Then** `src/db/schema.ts` defines `expenses` (`title`, `category`, `total_amount`, `incurred_at`, `party_name`, `note`, `attachments` + standard columns)
**And** `migrate.ts` is edited in BOTH places (CREATE blob + `addColumnIfMissing`)
**And** `expenseRepository` follows the factory + `.client.ts` pattern
**And** `ExpensesScreen` reads the repository; `DEMO_EXPENSES` is deleted
**Verifies:** *(FR12, UX-DR6)*

**Given** an expense has NO `paid` column by design
**When** its debt is needed
**Then** it is derived: `total_amount − Σ transactions where ref_kind='expense'` — the SAME rule as suppliers. One concept, not two.

**Given** rent is owed to a landlord
**When** an expense is created
**Then** `party_name` is FREE TEXT, not a supplier FK — the landlord sells nothing and must not pollute the Suppliers list

### Story 3.2: Pay the rent

As a **shop owner**,
I want to record paying my rent, in full or in part,
So that a bill I have already settled stops showing up as something I owe.

**Acceptance Criteria:**

**Given** a rent expense of 20000 and a payment of 5000 (`ref_kind='expense'`)
**When** debt is computed
**Then** `owed(expense) === 15000`, and it still shows as unpaid
**Verifies:** TC-5.3 *(FR13)*

**Given** the expense screen
**When** the owner taps سداد on an expense
**Then** the SAME reusable sheet from Story 2.3 opens (amount, cash|InstaPay, date, conditional proof, note)
**And** it writes one `transactions` row with `ref_kind='expense'`, `ref_id = <expense id>`
**And** the expense's paid/unpaid state updates
**Verifies:** *(UX-DR2, UX-DR6)*

### Story 3.3: Know what I owe in total — not just to suppliers

As a **shop owner**,
I want the app's "what I owe" figure to include my rent and bills,
So that it is not quietly telling me a number that is far too small.

**Acceptance Criteria:**

**Given** supplier debt of 5500 AND an unpaid rent expense of 20000
**When** the Home payables KPI renders
**Then** it reads **25500**, not 5500
**And** `dashboard-stats.ts` no longer sums `suppliers.balance` at all
**Verifies:** TC-5.2 *(FR14, UX-DR9)*

**Given** the debts report
**When** it renders
**Then** unpaid expenses are visible alongside supplier debt (the owner's real question is "what do I owe", and suppliers are only one slice of it)

---

## Epic 4: The Complete Money Picture

Every movement of money lands in one ledger. The owner can reconcile the physical drawer against the app — which is what makes the app trustworthy.

### Story 4.1: Record how the customer paid me

As a **shop owner**,
I want to record whether a sale was paid in cash, by InstaPay, or split across both,
So that my drawer and my InstaPay balance both match reality at the end of the day.

**Acceptance Criteria:**

**Given** a sale document of 10000 paid in cash
**When** it is saved
**Then** one `transactions` row: `direction=+1`, `amount=10000`, `account='cash'`, `ref_kind='sale'`, `ref_id = <document id>`
**And** `cash('cash')` increases by 10000
**Verifies:** TC-3.1 *(FR19)*

**Given** customer debt (AR) is deprecated and unbuilt, so there is no book to hold an unpaid sale
**When** a sale is saved
**Then** `Σ transactions(ref_kind='sale', ref_id=doc)` MUST EQUAL `doc.total_amount` — a short-paid sale is REJECTED, because the money would otherwise vanish with nowhere to record it
**Verifies:** TC-3.2
> If this ever proves wrong in the real shop, that is the signal to un-deprecate AR — it is not a constraint to paper over.

**Given** a sale of 10000 paid 5000 cash + 5000 InstaPay
**When** it is saved
**Then** TWO transaction rows are written, both `ref_kind='sale'`, both pointing at the SAME document
**And** `cash('cash')` +5000 and `cash('instapay')` +5000
**And** the fully-settled invariant still holds (5000 + 5000 === 10000)
**Verifies:** TC-4.3 *(UX-DR10)*

**Given** a sale paid by InstaPay
**When** it is saved
**Then** the screenshot attaches to the TRANSACTION, and `cash('cash')` is unchanged
**Verifies:** TC-4.1 *(FR24)*

### Story 4.2: See every riyal that moved

As a **shop owner**,
I want one ledger showing all money in and out, with a running balance per pocket,
So that I can count the drawer and check the app agrees.

**Acceptance Criteria:**

**Given** `CashBookScreen` is an `UnderConstruction` stub
**When** this story is implemented
**Then** it renders the `transactions` table ordered by `occurred_at` descending, grouped by day
**And** each row shows why the money moved (supplier payment, sale, expense, drawing, transfer)
**And** balances for **cash** and **InstaPay** are shown SEPARATELY — a single merged number can never be reconciled against anything
**Verifies:** *(FR15, UX-DR5)*

**Given** any dataset
**When** balances are computed
**Then** `Σ(direction × amount)` per account === that account's reported balance, always. Property-test this against a randomized transaction set.
**Verifies:** TC-7.3 *(NFR11)*

**Given** a soft-deleted transaction
**When** any figure is computed
**Then** it affects NOTHING — not debt, not cash, not the daily split
**Verifies:** TC-7.4

### Story 4.3: Record money I took for myself

As a **shop owner**,
I want to record cash I took out of the drawer for personal reasons, or money I put in from my own pocket,
So that the app's cash figure keeps matching the drawer instead of quietly drifting away from it.

**Acceptance Criteria:**

**Given** the owner takes 2000 from the drawer
**When** he records it (`ref_kind='owner'`, `direction=-1`, `ref_id=null`)
**Then** `cash('cash')` decreases by 2000
**And** NO supplier debt anywhere changes
**Verifies:** TC-7.1 *(FR16, NFR10)*
> This is what stops the cash book having a hole in it. The day the app's figure stops matching the physical drawer is the day the owner stops trusting the app — and an untrusted cash book is worse than none.

**Given** the cash book
**When** the owner needs to record something that fits no category
**Then** a `ref_kind='other'` escape hatch exists, so no movement of money is ever unrecordable

### Story 4.4: Move money between the drawer and InstaPay

As a **shop owner**,
I want to record moving cash into InstaPay (or out of it),
So that a transfer does not look like a loss.

**Acceptance Criteria:**

**Given** 5000 moves from the drawer to InstaPay
**When** the owner records the transfer
**Then** TWO rows are written, both `ref_kind='transfer'`: (`−1`, 5000, `cash`) and (`+1`, 5000, `instapay`)
**And** `cash('cash')` −5000, `cash('instapay')` +5000
**And** **total cash across all accounts is UNCHANGED** — a transfer is neither income nor expense
**Verifies:** TC-7.2 *(FR17)*

**Given** the cash book
**When** a transfer renders
**Then** it is visibly a transfer, not two unrelated movements

### Story 4.5: Know what I sold today — cash versus InstaPay

As a **shop owner**,
I want to see how much I sold today in cash and how much through InstaPay,
So that I can count the drawer at closing and know what to expect.

**Acceptance Criteria:**

**Given** on day D: a 10000 cash sale, a 7000 InstaPay sale, and a 3000 cash sale
**When** the daily figure renders
**Then** `salesToday('cash') === 13000`, `salesToday('instapay') === 7000`, total 20000
**And** the figure is summed from **`transactions`** filtered on `occurred_at` — NEVER from `documents`, which has no `account` column and physically cannot answer "which pocket"
**Verifies:** TC-6.1 *(FR18, NFR12)*

**Given** on day D: a 10000 cash sale AND a 4000 cash payment to Ahmed
**When** the daily sales figure renders
**Then** `salesToday('cash') === 10000` — filtered on `ref_kind='sale'`, so the outgoing supplier payment is excluded
**And** the day's NET cash movement is +6000
**Verifies:** TC-6.2
> Sales and cash-flow are different questions. This is what stops them being fused.

**Given** a sale of 10000 split 5000 cash + 5000 InstaPay
**When** the daily figures render
**Then** `salesToday('cash') === 5000` and `salesToday('instapay') === 5000` — one sale, correctly counted once in each pocket
**Verifies:** TC-6.4

**Given** sales at 23:59:59 on day D and 00:00:01 on day D+1
**When** they are bucketed
**Then** they land in different days, bucketed in the shop's LOCAL timezone (Egypt) — never UTC
**Verifies:** TC-6.3
