# UX / SW Review — Arabic Retail ERP Mobile Design Prototype

> Senior UI/UX + software-cycle review of `arabic-retail-erp-mobile-desig` (Vite + React 19 + Tailwind v4, RTL Arabic mock).
> Driven live in Chrome (localhost:3001), screens walked + source read.
> Reviewer pass: 2026-07-06. Verdict = **strong UX reference, NOT an architecture reference.**

---

## 0. What this prototype is

- **High-fidelity RTL clickable mock.** 12 screens, real Egyptian-pound (ج.م) formatting, Cairo-style Arabic, men's-clothing demo data.
- **In-memory only.** All state = `useState` in `App.tsx` (products/customers/suppliers/documents/branches). A "reset data" reseeds from `mockData.ts`. No DB, no persistence, no network.
- **Purpose:** validate the *screens + flows + language*, not the data layer. Treat every visual/interaction decision here as a spec input; treat every data decision as throwaway.

Screen inventory: Dashboard · Products · NewSale · NewPurchase · Documents · Reports · Customers · SupplierDebts · CashBook · Expenses · More · + modals (Scanner, AddItem, Customers, Suppliers).

---

## 1. Business cycles — observed UX flows

### 1.1 Sales cycle (صادر · بيع) — core money loop ✅
```
Home → صادر جديد
  → pick customer  [existing | زبون جديد quick-add | بيع نقدي walk-in]
  → (customer shows مديونية سابقة = prior debt hint)
  → set store + date
  → add items:  إضافة صنف modal (search-or-type name, unit price, qty stepper, live subtotal)
              | مسح باركود (camera scan → line)
  → line list w/ qty ± steppers, edit price/qty, delete
  → totals card:  المدفوع نقدًا (editable) → المتبقّي دَين (auto) → الإجمالي
  → حفظ المستند
      ├─ stock −qty per line
      ├─ if remaining>0 → customer.debt += remaining
      └─ new document appended
```
**Guard rule (correct):** walk-in (بدون زبون) **cannot** carry debt — save blocked with a clear toast. You can only owe if you're a named party. Good accounting discipline.

### 1.2 Purchase cycle (وارد · شراء) — mirror
Same shell as sale (NewPurchaseScreen), supplier instead of customer, stock **+qty**, `supplier.debt += remaining`. Purchase price prefill = `sale × 0.6` (demo margin heuristic).

### 1.3 AR collection (الديون حسب الزبون) — receivables
Customers screen + dashboard "ديون لك (زبائن)" → collect → `customer.debt -= amount`. Daily-collection stat on home (٪٧٤ محصّل).

### 1.4 AP payment (الديون حسب المورد) — payables
SupplierDebts screen + dashboard "ديون عليك (موردون)" red urgent card → pay → `supplier.debt -= amount`.

### 1.5 Inventory cycle
Products screen (add/edit/delete, low-stock threshold per product). Stock moves only as a **side-effect of sale/purchase docs** — the right conceptual model. Home "قيمة المخزون" = Σ(price×qty).

### 1.6 Closing / reporting cycle (التقارير) — ✅ genuine
Closing-accounts set: **P&L** (Revenue → COGS → operating profit → OpEx → Net, handles losses/negative margin correctly), Cash book, Expenses, AP-by-supplier, Stock movement, store snapshot. Period tabs: today/week/month/year.

### 1.7 Expense cycle (النفقات)
Standalone expense entries (rent/salary/utilities) → feed OpEx line in P&L.

---

## 2. Senior UI/UX assessment

### Strengths (keep these — promote to spec)
- **RTL is native, not flipped-LTR.** Reading order, numerals (٠-٩), currency suffix placement all correct. This is the hardest thing to retrofit — it's right here.
- **Plain-owner language.** "ديون لك / ديون عليك" (money to you / on you) beats "AR/AP". "المتبقّي دَين" makes partial-payment obvious.
- **Prior-debt hint at point of sale.** Showing "مديونية سابقة: ٣٬٢٠٠" while billing the same customer = excellent — owner sees exposure before extending more credit.
- **Editable cash-paid → live remaining-debt.** The single most important interaction in a credit-shop; it's immediate and unambiguous.
- **Walk-in vs named-customer split** with the debt guard = correct trust model.
- **Barcode offered, never required** — inline scan on both the item field and as a quick action. Matches the camera-first + optional-HID plan.
- **Consistent card system**, teal primary (#0E7569), red=owed-by-you urgency, amber=to-collect. Color carries meaning consistently.

### Issues / UX gaps (ranked)
1. **Customer-picker modal has no in-modal search over existing customers.** It offers walk-in + quick-add(name/phone) only; selecting an *existing* customer relies on the separate field dropdown. The locked spec (`design-prompts/04-new-outgoing.md §2a`) calls for a **live search filtering existing by name OR phone** inside the picker. → add a search box + results list (with debt hint) above the quick-add row.
2. **No variant (size/color) model in UI.** Clothing items are flat rows ("تيشرت … أسود"). No style→variant matrix, no "total across variants". This is the open data-model fork — decide before Step 1 schema. (Recommend parent+variants.)
3. **No aging on debts.** AR/AP show a single balance, no buckets (0-30/30-60/60+). Cash-flow blind spot; the target app has the same gap — chance to beat it.
4. **Date field uses native `<input type=date>`** (LTR mm/dd/yyyy control inside an RTL form) — visually inconsistent, and clipped ("06/07/202"). Use an RTL-aware date component with Arabic month names.
5. **No undo / confirm on destructive line delete** (حذف الصنف deletes immediately). The target app's #2 complaint is "no undo". Add undo-toast or confirm.
6. **Faint clipped rounded-rect at left screen edge** on several screens (off-canvas element). Cosmetic.
7. **`المدفوع نقدًا` defaults to a hardcoded "1000"** — should default to full total (خالص) or 0, not an arbitrary number that silently creates debt.

---

## 3. Software-cycle review (source read)

> These are correctness notes on the **prototype code**. Because it's a throwaway mock, none are "bugs to fix here" — they are **guard-rails for the real RN build**, where the same cycle must be re-implemented on SQLite/Drizzle.

| # | Prototype does | Locked plan requires | Action for real build |
|---|---|---|---|
| SW1 | Money = JS `number` (`parseFloat`, `price*qty`, `toFixed`) | **Integer minor units** (piastres) | Never port the float math. Money = INTEGER. |
| SW2 | Stock = direct mutation (`quantity - deduct`) | **Immutable movement ledger**, on-hand derived | Port the *cycle* (sale⇒−qty) but as a posted document row, not a mutation. |
| SW3 | P&L partly static (branch `monthlyProfit` seed); COGS shown but not computed from cost | **Weighted-average COGS** from incoming lines | Compute COGS/P&L from the ledger + avg_cost. |
| SW4 | `docNumber = SAL-2026-${random(100..900)}` | Unique sequential/UUID | Collision-prone; use counter or UUIDv7. |
| SW5 | No persistence (reset reseeds) | SQLite source of truth | Expected — mock only. |
| SW6 | Customer picker = walk-in + quick-add only | + live search of existing by name/phone | See UX gap #1. |

### Cycle logic that IS correct (port the intent)
- `totalAmount = Σ(price×qty)`, `debtAmount = max(0, total − cashPaid)` — clean.
- Walk-in + `debtAmount>0` → **blocked** (can't owe anonymously). ✅
- Sale posts stock decrement per line **and** debt increment atomically in the handler. ✅
- P&L statement structure (Revenue → COGS → Operating → OpEx → Net) with correct negative/loss handling. ✅

---

## 4. Traceability to locked plan

- ✅ Confirms customer-at-receipt flow (`04-new-outgoing.md §2a`) — mostly; missing the existing-customer search (gap #1).
- ✅ Confirms clothing domain + EGP.
- ⚠ Surfaces the **variant model** decision (gap #2) — still open, blocks Step-1 schema.
- ⚠ Prototype money/stock/COGS approach **contradicts** `data-model.md` (integer minor units, immutable ledger, weighted-avg) — must not be copied; use it for pixels/flows only.

---

## 5. Recommended next actions
1. Add existing-customer **search+list** to the picker modal (close gap vs spec).
2. Decide **variant model** (parent+variants recommended) → then lock Step-1 schema.
3. Add **debt aging buckets** to AR/AP (beat the target app).
4. Swap native date input → RTL Arabic date component.
5. Add **undo** on line/item delete.
6. When building RN screens from this mock: copy **layout + language + interaction**, re-implement **all money/stock/COGS** on the SQLite ledger with integer minor units.
