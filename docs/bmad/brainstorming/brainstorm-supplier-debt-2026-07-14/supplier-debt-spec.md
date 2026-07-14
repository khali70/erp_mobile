# Supplier Debt (AP) + Cash Book — Design & Implementation Spec

**Date:** 2026-07-14
**Source:** brainstorming session (Creative Partner mode) — see `.memlog.md`
**Status:** design agreed, ready to build

---

## 1. The core insight

**You are not building a debts feature. You are adding one missing event — "money moved" — and everything else is arithmetic over data you already store.**

A posted purchase document with a `party_id` *already is* the event "I took 60 ج.م of goods from Ahmed." That debt has been sitting in the `documents` table all along. Nothing ever read it as debt.

## 2. What's broken today

`suppliers.balance` is a **dead column**. It is set to `0` at supplier creation and **nothing ever writes it again**. Yet the entire read-side UI already consumes it:

| Consumer | File | Behaviour today |
|---|---|---|
| `DebtBadge` | `src/features/parties/components/DebtBadge.tsx` | never renders |
| `withDebt` filter chip | `src/features/parties/screens/SuppliersListScreen.tsx` | **commented out** — always matched nothing |
| Home KPI `supplierDebt` | `src/features/inventory/dashboard-stats.ts:37` | always shows 0 |
| `prevDebt` line ("مديونية سابقة للمورد علينا") | `src/features/documents/components/PartyCard.tsx` | never renders |
| `DebtsBySupplierScreen` | `src/features/reports/screens/DebtsBySupplierScreen.tsx` | 6-line `UnderConstruction` stub |
| `CashBookScreen` | `src/features/cashbook/screens/CashBookScreen.tsx` | `UnderConstruction` stub, no data source possible |
| Expenses | `src/features/expenses/data.ts` | pure mock (`DEMO_EXPENSES`), no table |

**The feature is a UI shell over a number that is permanently zero.** The supplier picker on the purchase screen already works perfectly — the missing piece was never the supplier, it was any notion of **money paid**.

Also note: the repo already contains a **contradiction**. `DebtsBySupplierScreen.md` specifies *"Balances derived from unpaid purchase documents − payments. Never hand-edited."* The schema stores a `balance` column. This spec resolves it in favour of the `.md`: **derive, never store.**

---

## 3. Database

### 3.1 Conventions (existing, unchanged)

- Every table: `id` (text PK), `created_at`, `updated_at` (integer, unix ms), `deleted_at` (integer, nullable — soft delete).
- **All money is integer minor units** (piasters). 60 ج.م → `6000`. Never floats.
- Polymorphic FKs are **untyped and unconstrained**, resolved by a sibling `kind` column — this is house convention (`documents.party_id` already works this way).

### 3.2 NEW TABLE — `transactions` (the cash book)

**Every single movement of money, in or out, no exceptions.** This is *not* a "payments" table. Paying a supplier is merely one reason money moves.

```ts
transactions
  id           text     PK
  created_at   integer  NOT NULL
  updated_at   integer  NOT NULL
  deleted_at   integer  NULL

  direction    integer  NOT NULL   // +1 money IN, -1 money OUT
  amount       integer  NOT NULL   // minor units, always positive
  occurred_at  integer  NOT NULL   // when money MOVED (not when typed)
  account      text     NOT NULL   // 'cash' | 'instapay'
  ref_kind     text     NULL       // why it moved: supplier|expense|sale|owner|transfer|other
  ref_id       text     NULL       // what it points at, resolved by ref_kind
  note         text     NULL
  attachments  text     NULL       // JSON metadata — PROOF OF MONEY
```

**`ref_kind` / `ref_id` is the whole engine:**

| `ref_kind` | `ref_id` points at | Meaning | direction |
|---|---|---|---|
| `'supplier'` | `suppliers.id` | you paid Ahmed → **reduces his debt** | −1 |
| `'expense'` | `expenses.id` | you paid rent/electricity → reduces that expense's debt | −1 |
| `'sale'` | `documents.id` | customer paid you | +1 |
| `'owner'` | `null` | owner drawings / capital injection | ±1 |
| `'transfer'` | `null` | drawer ↔ InstaPay (**two rows**, netting to zero) | ±1 |
| `'other'` | `null` | escape hatch | ±1 |

> **Walk-in purchases have no null case.** A seeded **sentinel supplier** (`system-walkin-supplier`) absorbs them, so `party_id` is never null and a walk-in payment is an ordinary `ref_kind='supplier'` row. See §3.7.

> **Why `owner` / `transfer` / `other` must exist:** a cash book with a hole in it is worse than no cash book. The moment the owner takes 200 for lunch and the app can't record it, the app's cash figure stops matching the physical drawer — and he stops trusting the app.

> **Why `account` must be a real column, not a placeholder:** cash and InstaPay are two separate pockets that each reconcile independently. The drawer has notes you can count; InstaPay has a balance in an app. If a transaction doesn't say which pocket, **neither can ever be checked.**

> **Transfers are not income or expense.** Moving money drawer → InstaPay is the same money in a different pocket. Two rows (out of `cash`, into `instapay`), `ref_kind='transfer'`, netting to zero cash change. Miss this and every transfer looks like a loss.

### 3.3 NEW TABLE — `expenses`

Currently pure mock data. Must become real, because **rent is debt too** — debt is not derived from purchase invoices alone, it's derived from *obligations*, and a purchase invoice is only one generator of them.

```ts
expenses
  id           text     PK
  created_at   integer  NOT NULL
  updated_at   integer  NOT NULL
  deleted_at   integer  NULL

  title        text     NOT NULL
  category     text     NULL
  total_amount integer  NOT NULL   // minor units
  incurred_at  integer  NOT NULL
  party_name   text     NULL       // free text — the landlord is NOT a supplier
  note         text     NULL
  attachments  text     NULL
```

**No `paid` column.** An expense's debt is `total_amount` minus whatever transactions point at it. Same rule as suppliers — **one concept, not two.**

`party_name` is deliberately free text, not an FK: the landlord would pollute the Suppliers list, and he sells you nothing.

### 3.7 NEW — sentinel parties (`is_system`)

A walk-in purchase ("شراء نقدي مباشر (بدون مورد)") today sets `party_id = null`, and a walk-in sale ("بيع نقدي (بدون زبون)") does the same. That null forces a special case into **every** query and leaves a cash payment with nothing to point at.

**Fix: seed one sentinel row in each party table.** `party_id` is then never null, and every payment is an ordinary `ref_kind='supplier'` transaction. The null-object pattern — the special case is handled once, in the seed, instead of in every query.

```ts
// ADD to both `suppliers` and `customers`:
  is_system  integer  NOT NULL  DEFAULT 0   // 1 = sentinel, not a real party

// SEED in migrate.ts (idempotent — INSERT OR IGNORE on a fixed id):
  suppliers: id='system-walkin-supplier', name='نقدي (بدون مورد)',  is_system=1, balance=0
  customers: id='system-walkin-customer', name='نقدي (بدون زبون)',  is_system=1, balance=0
```

**A sentinel is dangerous unless it is defended.** All four guards are required:

| Guard | Where | Why |
|---|---|---|
| **Hidden from party lists** | `supplierRepository.list()` / `customerRepository.list()` — filter `is_system = 0` | else "نقدي (بدون مورد)" appears as a supplier the owner can tap |
| **Undeletable / unarchivable / uneditable** | `update()`, `archive()` must reject `is_system=1` | delete it and **every walk-in document orphans** |
| **Excluded from the debts report** | `owed()` and the debts list skip `is_system=1` | a mis-keyed walk-in would otherwise read *"بدون مورد owes you 500"* — meaningless, and it would corrupt the payables KPI |
| **Still visible in the cash book** | no filter on `transactions` | the money genuinely moved; the cash book must never have a hole |

**Migration must backfill:** existing documents with `party_id IS NULL` get repointed at the matching sentinel (`kind='in'` → supplier sentinel, `kind='out'` → customer sentinel). Do this in `migrate.ts` in the same pass that adds the column.

**UI:** `PartyPicker`'s walk-in option (`documents.incoming.walkIn` / `documents.outgoing.walkIn`) now resolves to the sentinel id instead of `null`. The label the user sees is unchanged.

> **The customer sentinel earns its place even though AR is deprecated** — a walk-in *sale* still needs a `ref_kind='sale'` payment row, and keeping both tables symmetric means AR can be un-deprecated later without a migration.

### 3.4 CHANGED — `suppliers.balance` is retired

Keep the column (dropping it means a table rebuild in SQLite), but **stop reading it**. It becomes at most an optional cache, populated by nothing in v1. All consumers switch to the derived query.

### 3.5 UNCHANGED — everything else

`documents`, `document_lines`, `items`, `categories`, `tags`, `stock_levels`, `customers` need no changes. `documents.note` and `documents.attachments` already exist and are already collected by the purchase screen.

### 3.6 Two kinds of proof, two homes

This was the one real gap found in the ERD review, and it matters:

| Attachment | Home | What it proves |
|---|---|---|
| Supplier's paper invoice, photo of goods that arrived | `documents.attachments` | **proof of GOODS** |
| InstaPay screenshot, signed cash receipt | `transactions.attachments` | **proof of MONEY** |

**Why proof cannot live on the document:** buy 300 from Ahmed, pay 100 cash at delivery, 100 by InstaPay next week, 100 the week after. **Three payments, three different proofs.** If they all hang off `documents.attachments` there is no way to know which proof belongs to which payment. And an on-account payment covering two invoices has no single document to attach to at all.

---

## 4. Everything derives — nothing is stored

```sql
-- what you owe one supplier
owed(S)   = Σ documents.total_amount   WHERE kind='in' AND party_id=S AND status='posted' AND deleted_at IS NULL
          − Σ transactions.amount      WHERE ref_kind='supplier' AND ref_id=S AND deleted_at IS NULL

-- what you owe on one expense
owed(E)   = E.total_amount
          − Σ transactions.amount      WHERE ref_kind='expense' AND ref_id=E AND deleted_at IS NULL

-- total payables (the Home KPI, corrected — it currently only counts suppliers)
payables  = Σ owed(S) for all S  +  Σ owed(E) for all E

-- cash on hand, per pocket
cash(A)   = Σ (direction × amount)     WHERE account=A AND deleted_at IS NULL

-- the cash book
cashbook  = transactions ORDER BY occurred_at DESC
```

**Why derived and not a stored column:** a stored debt number can go wrong. It drifts the first time a save half-fails, a doc is soft-deleted, or two writes race. Then the owner sees "you owe Ahmed 340" while the invoices add up to 300, and he cannot tell which is lying. **A derived number cannot disagree with the invoices, because it *is* the invoices.**

Performance: at this scale (a handful of suppliers, debt is rare) this is microseconds. Cache only if it ever proves slow — and only as a cache.

### 4.1 Invoice-level detail is derived too

The payment points at the **supplier**, not at an invoice. That is what collapses the entire allocation table. To show *which invoices* a payment settled, walk Ahmed's invoices oldest-first against his payments oldest-first **at read time**:

```
IN-000012 · سُدّدت بالكامل — 25
IN-000014 · سداد جزئي — 15  (باقي 10)
```

This is deterministic **because manual invoice-picking was ruled out** — there is no user override that could contradict the FIFO walk. Aging ("this debt is 45 days old") falls out of the same walk.

### 4.2 AP and AR never auto-net

If Ahmed is both a supplier (you owe 60) and a customer (he owes you 100), those are **two separate obligations in two separate books.** Do not silently net them to 40. Offsetting is an explicit action, never a default — netting silently is how you end up in an argument you cannot reconstruct.

---

## 5. UI changes

### 5.1 `NewIncomingScreen` — the gap in the screenshot

`src/features/documents/screens/NewIncomingScreen.tsx` + `src/features/documents/hooks/useDocumentForm.ts`

The summary footer today shows only **عدد الأصناف** and **الإجمالي**. Add payment:

```
عدد الأصناف                    ١ أصناف
الإجمالي                       ٦٠ ج.م
─────────────────────────────────────
المدفوع                     [ ٦٠ ]      ← defaults to FULL TOTAL
الحساب              [ نقدي ] [ إنستاباي ]
إثبات الدفع            [ 📷 صورة ]       ← shown only when إنستاباي
─────────────────────────────────────
المتبقي (دين)                   ٠ ج.م    ← shown only when > 0
```

**The paid field defaults to the full total.** The shop rarely buys on debt — debt is the exception, not the rule. So the common path stays zero-effort, and leaving less than the total is a deliberate act.

**On save:**
- `paid === total` → write doc + 1 transaction (`−1`, `ref_kind='supplier'`, `ref_id=partyId`). No debt.
- `0 < paid < total` → same, remainder becomes debt automatically.
- `paid === 0` → write doc only, **no transaction row**. Full debt.
- Walk-in → `party_id = 'system-walkin-supplier'` (never null). Paid must equal total; a sentinel must never carry debt. The transaction is an ordinary `ref_kind='supplier'` row pointing at the sentinel.

**Sales invariant:** customer debt (AR) is deprecated and unbuilt, so there is no book to hold an unpaid sale. `Σ transactions(ref_kind='sale', ref_id=doc)` **must equal** `doc.total_amount`. A sale may be split across pockets (5000 cash + 5000 InstaPay = two rows, one document), but it may not be left short — money would vanish with nowhere to record it.

The `prevDebt` line already coded into `PartyCard` will finally render.

### 5.2 `DebtsBySupplierScreen` — replace the stub

`src/features/reports/screens/DebtsBySupplierScreen.tsx` (currently 6 lines of `UnderConstruction`)

**List:** suppliers where `owed(S) > 0`, sorted by amount descending. Row = name, phone, total owed, age of oldest unpaid debt.

**Detail (on tap):** that supplier's invoices with the derived FIFO breakdown, his payment history, and a **سداد** button.

**سداد sheet:**
```
المبلغ            [ 100 ]
الحساب       [ نقدي ]  [ إنستاباي ]
التاريخ           [ اليوم ]
إثبات الدفع    [ 📷 صورة ]      ← only when إنستاباي
ملاحظة          [ ... ]
```
Writes exactly one transaction row. Cash needs no proof — the money was handed over, both men saw it. **InstaPay *is* a screenshot**, and that screenshot is the only evidence it happened.

### 5.3 Falls out for free

- **`SuppliersListScreen`** — uncomment the `withDebt` filter chip. The i18n key `suppliers.filters.withDebt` ("عليهم ديون") **already exists in ar and en.**
- **`DebtBadge`** — starts rendering.
- **Home KPI** — `dashboard-stats.ts:37` stops always saying 0. **Correct it to count expenses too**, not just suppliers — it currently under-reports what the owner actually owes.
- **`CashBookScreen`** — the `transactions` table *is* its data source. Real in/out ledger, no new concepts.
- **Daily sales (cash vs InstaPay)** — must be summed from `transactions.occurred_at`, **never** from `documents`. `documents` has no `account` column and physically cannot answer "which pocket". A sale split across both pockets is one document and two transaction rows, and only the transaction-based query counts it correctly.
- **Expenses** — stop being mock; get a real table and repository.

---

## 6. Implementation checklist

### Data layer
- [ ] `src/db/schema.ts` — add `transactions` and `expenses` tables (Drizzle definitions).
- [ ] `src/db/schema.ts` — add `is_system` (integer, default 0) to `suppliers` **and** `customers`.
- [ ] `src/db/migrate.ts` — seed the two sentinel parties, `INSERT OR IGNORE` on fixed ids (idempotent — runs on every boot).
- [ ] `src/db/migrate.ts` — backfill: repoint every `party_id IS NULL` document at the matching sentinel.
- [ ] Guard the sentinel: `supplier/customerRepository.list()` and `count()` filter `is_system=0`; `update()` and `archive()` **reject** `is_system=1`. (Archiving it orphans every walk-in document in history.)
- [ ] `PartyPicker.tsx` — the walk-in option resolves to the sentinel id, not `null`. Visible label unchanged.
- [ ] `src/db/migrate.ts` — **hand-written, two places each**:
      (a) add `CREATE TABLE IF NOT EXISTS` to the boot blob for fresh installs;
      (b) add `addColumnIfMissing` lines for upgrade paths.
      *(Note: `drizzle-kit generate` is wired in package.json but `src/db/migrations/` does not exist and has never been used. Do not assume generated migrations.)*
- [ ] Indexes: `idx_tx_ref (ref_kind, ref_id)`, `idx_tx_occurred (occurred_at)`, `idx_tx_account (account)`.
- [ ] `src/repositories/transaction-repository.ts` — follow the **factory + `.client.ts` singleton** pattern used by `document-repository.ts` (so tests can inject better-sqlite3). Methods: `create`, `listByRef`, `listForCashBook`, `sumByRef`, `cashByAccount`, `archive`.
- [ ] `src/repositories/expense-repository.ts` — same pattern.
- [ ] `src/repositories/debt-repository.ts` (or extend supplier-repository) — the derived queries in §4. Include the FIFO walk for invoice-level breakdown.
- [ ] **Transaction safety:** `expo-sqlite`'s sync driver **cannot nest transactions**. `documentRepository.create()` already wraps in `db.transaction()`; writing the payment row must happen inside that same transaction, not in a nested one.

### Document form
- [ ] `useDocumentForm.ts` — add `paidAmount` (default = total), `account`, `paymentAttachments` to form state + MMKV draft.
- [ ] `documentRepository.create()` — accept an optional payment, write the `transactions` row in the same db transaction as the doc + lines.
- [ ] `NewIncomingScreen.tsx` — the payment card in §5.1.
- [ ] Validation: `0 ≤ paid ≤ total`; walk-in requires `paid === total`.

### Screens
- [ ] `DebtsBySupplierScreen.tsx` — replace stub (list + detail + سداد sheet).
- [ ] New `SupplierDebtDetailScreen` + route in `src/navigation/RootNavigator.tsx`.
- [ ] `SuppliersListScreen.tsx` — uncomment the `withDebt` chip.
- [ ] `dashboard-stats.ts` — swap `Σ suppliers.balance` for the derived payables query; **include expenses**.
- [ ] `CashBookScreen.tsx` — replace stub, read `transactions`.
- [ ] `ExpensesScreen.tsx` — swap `DEMO_EXPENSES` for the real repository.

### i18n
- [ ] New namespaces in `src/i18n/locales/{ar,en}.json`: `debts`, `cashbook`, `payments`. None exist today — the stub screens hardcode Arabic titles.
- [ ] New keys: paid amount, remaining/debt, account (cash/InstaPay), payment proof, settle (سداد), payment history, aging.
- [ ] Already present and usable: `suppliers.filters.withDebt`, `suppliers.debtHint`, `documents.incoming.prevDebt`.

### Tests
- [ ] `transaction-repository.test.ts` — use `src/db/testing/test-db.ts`, following `document-repository.test.ts`.
- [ ] Derived-debt correctness: partial payment, overpayment (negative balance = supplier owes you), on-account payment, soft-deleted doc excluded, draft doc excluded.
- [ ] FIFO walk: one payment spanning two invoices; payment exceeding all debt.
- [ ] Cash reconciliation: `Σ(direction × amount)` per account; transfer nets to zero.

---

## 7. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | **Oldest-first allocation** — you pay Ahmed 100 on a day he has two unpaid invoices. The app settles the oldest first. Always right, or does the owner sometimes mean a specific *newer* invoice? | **Ship oldest-first with no override in v1.** Manual picking was explicitly rejected as error-prone. Revisit only if it bites. |
| 2 | **Supplier returns** — returning goods reduces debt but is not a payment. A `kind='in'` document with a negative total? A `ref_kind='return'` transaction? | Not resolved. Likely a negative-total purchase doc, so it flows through the same debt query untouched. **Needs its own pass.** |
| 3 | **Overpayment** — pay 40 when you owe 25. The derived sum simply goes negative, correctly meaning Ahmed owes *you* 15. | Allowed by construction. Display as credit (رصيد لك); don't block it. |
| 4 | **"Rarely buys on debt"** — the whole "paid defaults to full total" UX rests on this. | Verify against the real shop before building. If debt is actually common, the default flips. |

---

## 8. Summary

**Two new tables. Six columns of real logic. Every stubbed screen you have gets a data source.**

The thing to hold onto:

> **Debt was never missing from your database. Only the payment was.**
