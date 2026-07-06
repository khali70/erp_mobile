# Step 2 — Parties & Balances (Customers, Suppliers, Debts AR/AP)

> **Goal:** customers + suppliers CRUD, attach a party to in/out documents, per-party ledger, and running **receivables (ديون لك)** + **payables (ديون عليك)** balances. No money math yet beyond debt accumulation — pricing lands in Step 3, but the debt *balance* concept starts here.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `CustomersScreen.tsx` (الزبائن) | `features/parties/screens/CustomersScreen` | list + search, per-customer debt, add customer, **collect debt** action |
| `SupplierDebtsScreen.tsx` (الموردون / ديون عليك) | `features/parties/screens/SuppliersScreen` | list, per-supplier debt (red urgent), **pay supplier** action |
| `DirectoryModals: CustomersModal / SuppliersModal` | `features/parties/components/PartyQuickSheet` | quick collect/pay from Dashboard |
| Party picker inside `NewSaleScreen` / `NewPurchaseScreen` | `features/parties/components/PartyPicker` | **shared component** — used by document forms in Step 3 |

## Entities / schema (see `data-model.md`)

- `customers` — id, name, phone, + 4 standard columns. **No `debt` column stored** — balance is *derived* from party transactions (mirror the ledger discipline; don't cache a mutable debt like the mock does).
- `suppliers` — id, name, phone, + 4 standard columns.
- `party_transactions` — id, party_id, party_type (`customer|supplier`), `direction` (charge/settle), `amount` (INTEGER minor units), `reference_id` (document/payment), `created_at`. Running balance = Σ(signed amounts).
- Party link on documents: add `party_id` + `party_type` to `documents` (nullable — walk-in sales have none).

## Key flows (port intent)

- **Party picker (fix UX gap #1):** the picker MUST have **live in-modal search of existing parties by name OR phone** (the mock lacks this — see `design-prompts/04-new-outgoing.md §2a`), plus:
  - `زبون جديد` quick-add row (digits typed → prefill phone, else name)
  - `بيع نقدي` walk-in chip (anonymous cash — **cannot carry debt**, guard below)
  - existing-party row shows **prior debt hint** (`مديونية سابقة: ٣٬٢٠٠`) so the owner sees exposure before extending credit.
- **Collect (AR):** customer screen → collect amount → write `party_transaction(settle)` → balance decreases. Cash-in row will feed the cash book (Step 3).
- **Pay (AP):** supplier screen → pay amount → `party_transaction(settle)` → payable decreases.
- **Per-party ledger:** chronological charges + settlements with running balance.

## Guard-rails (never port from mock)

- **SW6** picker needs existing-party search — the mock only has walk-in + quick-add.
- Do **not** store a mutable `debt` number and `debt += x` it (the mock does `customer.debt + debtToAdd`). Balance is **derived from `party_transactions`** so every debt figure is explainable and undoable.
- **Walk-in debt guard (port this — it's correct):** a sale with no named party **cannot** leave a remaining balance; block save with a clear toast. You can only owe if you're a named party.
- Money = INTEGER minor units.

## Dashboard wiring

- `ديون لك (زبائن)` (receivables, **warning/amber**) → Σ customer balances.
- `ديون عليك (موردون)` (payables, **danger/red**) → Σ supplier balances.
- Daily-collection stat (`٪٧٤ محصّل`) → today's settle transactions ÷ opening receivables.

## Done when

Every in/out document can name a party (or be walk-in), each party screen shows its transactions + a correct running balance derived from the ledger, collect/pay adjust balances, and the walk-in-can't-owe guard holds. Correct after restart.
