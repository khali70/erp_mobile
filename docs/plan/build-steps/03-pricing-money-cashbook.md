# Step 3 — Pricing, Money & Cash Book

> **Goal:** the core money loop. Priced sale/purchase documents with cash-paid → remaining-debt, payments against parties, and a reconciling **cash book (دفتر النقدية)**. This is where the two document screens become real.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `NewSaleScreen.tsx` (صادر جديد) | `features/documents/screens/NewSaleScreen` | party picker (Step 2) → date/store → add-item modal → line list (qty ± steppers, edit price/qty, delete) → totals card |
| `NewPurchaseScreen.tsx` (وارد جديد) | `features/documents/screens/NewPurchaseScreen` | mirror of sale; supplier; stock **+qty**; supplier debt on remaining |
| `DirectoryModals: AddItem` (line add) | `features/documents/components/AddLineSheet` | search-or-type name, unit price prefill, qty stepper, live subtotal |
| `CashBookScreen.tsx` (دفتر النقدية) | `features/cashbook/screens/CashBookScreen` | chronological cash-in/out incl. party settlements, running balance |

## Entities / schema (see `data-model.md`)

- Extend `items`: `cost_price`, `sale_price` already INTEGER minor units from Step 1; line price defaults from item.
- Extend `document_lines`: `unit_price`, `line_total` (INTEGER minor units), captured **at post time** (price history).
- Extend `documents`: `total_amount`, `cash_paid`, `debt_amount` (INTEGER minor units) — `debt_amount = max(0, total − cash_paid)`.
- `payments` — id, party_id, amount (minor units), method, reference_id, created_at (partial + full).
- `cash_entries` — id, direction (`in|out`), amount (minor units), source (`sale|purchase|settlement|expense|manual`), reference_id, created_at. **Cash book = derived from cash_entries**, running balance = Σ signed.
- `discounts` (line + document level) — optional, minor units or bps.

## Key flows (port intent — the sales cycle is the heart)

```
صادر جديد → pick party [existing search | quick-add | walk-in]
  → set store + date → add lines (item, qty, unit_price → subtotal)
  → totals card: المدفوع نقدًا (editable) → المتبقّي دَين (auto) → الإجمالي
  → حفظ المستند  ── atomic ──►
       ├─ post document (−1) + lines  → stock_levels −= per line (ledger)
       ├─ cash_paid > 0  → cash_entry(in)
       ├─ remaining > 0  → party_transaction(charge)  [named party only]
       └─ document row persisted, sequential/UUID doc number
```
- Purchase mirror: post (+1), `cash_entry(out)` for cash paid, supplier `party_transaction(charge)` for remaining.
- **Editable cash-paid → live remaining-debt** is the single most important interaction — keep it immediate and unambiguous.
- Payments/settlements from Step 2 write a `cash_entry` here so the cash book and party balances stay consistent.

## Guard-rails (never port from mock)

- **SW1** all totals INTEGER minor units. Never `parseFloat`/`toFixed`/`price*qty` in float. Do integer arithmetic, format only at render.
- **SW2** save **posts a document row** that drives stock; never mutate `item.quantity`.
- **SW3** capture `unit_cost` on every incoming line now → enables weighted-average COGS in Step 6 with no migration.
- **SW4** `docNumber` = sequential counter or UUIDv7, not `random(100..900)`.
- **SW7 (UX gap #7):** `المدفوع نقدًا` defaults to **full total (خالص)** or 0 — never the mock's hardcoded `1000` that silently creates debt.
- Walk-in + remaining>0 → **blocked** (port the guard).
- Atomicity: stock post + cash entry + party charge must be one DB transaction — partial failure leaves no half-posted document.

## Dashboard wiring

- `أرباح الشهر` (profit) → provisional from sale revenue − avg-cost COGS (full P&L in Step 6).
- Daily-collection banner ties to `cash_entries` of source `settlement`.

## Done when

Documents carry priced totals with discounts, saving posts stock + cash + party atomically, the walk-in guard and full-payment default hold, and the cash book reconciles exactly to Σ(cash_entries). Correct after restart.
