# صادر جديد — New Outgoing (Sale) Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Record a **goods-out document** (a sale). Decrements stock, books revenue, COGS at weighted-avg cost. **Sale is always paid in full, cash. No customer debt.**

## UX
- Header: date + store selector.
- **Customer picker (record tag only, NOT a debtor)** — search existing customers by **name or phone**, quick-add inline («＋ زبون جديد «010»» — auto-save typed value), or **walk-in** chip (بيع نقدي بدون زبون). Customer is optional and used only to stamp the receipt. **No prior-debt hint, no balance.**
- **Line items** — add item (search or **barcode scan**), qty, unit price (defaults to sale price). Live line totals.
- **Totals card** — **total only** (goods count + grand total). No "cash paid" input, no "remaining/debt" row. Sale is fully paid by definition.
- **Payment card (طريقة الدفع)** — *which pocket*, never *how much*. نقدي | إنستاباي, plus a **تقسيم الدفع** switch for one sale paid partly in cash and partly by InstaPay (the owner types only the cash half; InstaPay is the remainder **by construction**, so the two cannot fail to add up). إثبات الدفع (screenshot) appears only when InstaPay is involved, and attaches to the **transaction**, not the document.
- Save = atomic: −stock, +revenue, COGS at weighted-avg cost, and one `transactions` row **per pocket** (`ref_kind='sale'`, `direction=+1`, `ref_id` = this document).

## Navigation
- **In**: Home quick action «صادر جديد»; Documents list (＋).
- **Out**: back to Home/Documents on save; opens Scan for barcode; opens customer quick-add.

## Why needed
Selling is the core event that moves stock **and** money. Cash-only sale keeps the money model simple: every sale = revenue + cash-in, no receivables to chase.

## Locked feedback (2026-07-07 — owner)
1. **NO customer debt (AR removed).** Debt exists **only with suppliers (AP)**. Delete: prior-debt hint, «المدفوع نقدًا» input, «المتبقّي (دَين)» row. Customer picker stays for the record only.
2. **Summary card layout bug** (screenshot annotated «must be fixed»): the old remaining-debt row clipped/overflowed (`١,٠١٠` mis-rendered). Dropping that row removes the bug — summary now shows only goods-count + total. RTL number formatting must not clip.
3. **Speed — scan-to-append.** Barcode scan **auto-appends line qty=1 and re-focuses scanner** (scan-scan-scan rhythm), no modal per item. `إضافة صنف` stays for no-barcode goods. Qty stepper must also allow **tap-to-type** (stepper too slow past ~5 units).
4. **Never lose data — draft autosave.** Persist the in-progress sale to SQLite on **every** line/field change; restore on reopen. Half-entered sale must survive app kill / phone ringing. This is the real "never lose data" guard, not backup.
5. **Delete line = undo-able** — red trash needs confirm or undo-snackbar, no silent loss.

## Guard-rails (never port from web prototype)
Money = integer minor units. Stock via ledger, never direct mutation. **No AR — sale total always == money-in.** COGS at weighted-avg cost.

**The sales invariant:** `Σ transactions(ref_kind='sale', ref_id=doc) === doc.total_amount`, enforced in `documentRepository`. A short-paid sale is **REJECTED** — with AR deprecated there is no book to hold the remainder, so the difference would simply vanish: goods gone, money not in the drawer, and no record of who owes it. If this ever proves wrong in the real shop, that is the signal to **un-deprecate AR**, not to loosen the check.

**"Cash-in" is now two pockets.** The money lands in نقدي or إنستاباي (or both), and only the `transactions` rows know which — `documents` has no `account` column. Every daily cash/InstaPay figure is therefore summed from the transactions, never from the documents.
