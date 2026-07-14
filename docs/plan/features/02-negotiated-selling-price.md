# Feature 2 — Negotiated / Dynamic Selling Price

**Status:** proposed
**Verdict:** ✅ **Build it. Highest ROI of the four — and most of it is already written.**
**Headline:** the per-line price editor for sales **already exists and is fully wired**. It is unreachable because of one inverted boolean. Fixing that line *is* the core of this feature.

---

## 1. The bug that is hiding your feature

`src/features/documents/components/DocLineRow.tsx:35`

```ts
const isSale = mode === 'purchase';   // ← the name says sale, the value says purchase
```

Everything downstream reads that variable:

```ts
36:  const rateLabel  = isSale ? t('documents.unitPrice') : t('documents.unitCost');
37:  const totalLabel = isSale ? t('documents.lineTotal') : t('documents.lineCost');
...
56:  {isSale ? (
57–71:    <TextInput ... onChangeText={(v) => onPrice(parseNum(v))} />   // editable
72:  ) : (
73–76:    <Text>{rateLabel}: {formatNumber(line.unitPrice, lang)}</Text>  // read-only
77:  )}
```

Net effect today, exactly as shipped:

- **Purchase doc** (`NewIncomingScreen`) → rate is an **editable `TextInput`**, labelled *"unit price"*. It is a **cost**. Mislabelled.
- **Sale doc** (`NewOutgoingScreen`) → rate is **read-only `Text`**, auto-filled from `item.salePriceMinor`, labelled *"unit cost"*. It is a **price**. Also mislabelled.

So the merchant **cannot change the selling price at the moment of sale** — which is precisely the gap you're describing. Meanwhile the plumbing to do it is all present and correct:

- `useDocumentForm.ts:198` — `setPrice(id, unitPrice)` mutator, clamped at `Math.max(0, ...)`
- `DocLinesSection.tsx:98` — `onPrice={(p) => onSetPrice(line.id, p)}`
- `NewOutgoingScreen.tsx:68` — `onSetPrice={f.setPrice}`

The wire runs end to end. Only the render gate is inverted.

There's even a stale TODO sitting on line 53 (`make the total editable and the unit price fixed for !isSale mode`) and dead `useState` / "pencil reveals the inline editor" comments from a UI that no longer exists. Clean those out while you're in there.

**Fix the boolean, fix the two i18n labels, and you have a working negotiated-price flow in about an hour.** Everything below is what turns it from *working* into *good*.

---

## 2. What "good" looks like

A merchant haggling at the counter is doing arithmetic under social pressure. He needs to know one thing before he says yes: **am I still making money at this number?** The app should answer that without him asking.

### 2.1 Show the margin live, while he types

The single highest-value addition. As the price is typed, show beneath the field:

```
سعر القائمة: 250      التكلفة: 180
──────────────────────────────────
الربح: 20 (10%)   ← turns amber below target margin, red below cost
```

He types `200`, sees green. He types `170`, it goes red and says **"أقل من التكلفة"** (below cost). That's the whole feature. Everything else is decoration.

Cost is already at hand: `item.costPriceMinor` (`src/features/inventory/types.ts:17-29`). No query needed.

### 2.2 Anchor him with real numbers

Prefill the field with `item.salePriceMinor` (the list price) as it does today, but show as reference chips:

- **سعر القائمة** — `item.salePrice` (the anchor)
- **آخر سعر بيع** — the last `unitPrice` this item actually sold at (one indexed query on `document_lines`)
- **آخر سعر لهذا العميل** — the last price *this customer* paid. Powerful in a repeat-customer shop, and it stops the "but last time you gave it to me for 200" argument.

Start with list price + last sold. Add per-customer once the first two land.

### 2.3 A price floor, not a price lock

Add a **minimum price** per item. When the merchant types below it, don't block him — **warn him**. He's the owner; he may have a reason (clearing dead stock, a favour, a bundle). Blocking the owner from his own till is the fastest way to get an app deleted.

Two floors, ascending strictness:
1. **Below target margin** → amber, informational.
2. **Below cost** → red + a confirm on save (`"بعت بخسارة — متأكد؟"`). Still allowed.

### 2.4 Mark which items are negotiable

Not every item is haggled. Cigarettes have one price; a jacket doesn't. Add to `items`:

```sql
pricing_mode TEXT NOT NULL DEFAULT 'fixed'   -- 'fixed' | 'negotiable'
min_price    INTEGER                          -- minor units, nullable
```

- `fixed` → price field renders read-only, as today. Tap-to-override still available (long-press or a small pencil), because the owner always wins.
- `negotiable` → price field is focused and editable by default; the margin strip is shown.

This keeps fast-entry fast for the 80% of SKUs with one price, and puts the negotiation UI only where it earns its screen space.

---

## 3. The rule you must not break

**A negotiated price is a property of the *line*, not of the *item*.**

Selling one jacket at 200 instead of 250 must **not** rewrite `items.salePrice` to 200. If it does, the list price decays toward whatever the last haggler talked you down to, and the anchor is destroyed.

The current save path gets this right, and you must keep it right. `useDocumentForm.ts:360-361`:

```ts
salePrice: mode === 'sale' ? priceMinor : (importedSale ?? 0),
costPrice: mode === 'purchase' ? priceMinor : 0,
```

This writes back **only for items being find-or-created during the save** — i.e. a brand-new SKU typed in during fast entry, where the typed price is genuinely the only price information that exists. For an item that already exists, nothing is written back. That's correct. **Do not "improve" this into an update-on-every-sale.**

Corollary: **P&L already works.** `dashboard-stats.ts:39-54` computes revenue as `Σ line.qty × line.unitPrice` — the *actual* line price, not the list price — and COGS from `item.costPrice`. So a negotiated sale flows into monthly profit correctly the moment the price field becomes editable. No reporting change needed.

---

## 4. Traps in the current code

**4.1 The major/minor unit asymmetry.** Draft lines carry **major units as floats** (`src/features/documents/types.ts:5-27`, `unitPrice: number` — "whole currency units"), converted to minor exactly once at save (`useDocumentForm.ts:344`, `toMinor(l.unitPrice)`). This is a deliberate, documented boundary. When you add the margin strip, you're mixing a *major-unit* draft price with a *minor-unit* item cost — **convert once, at the edge, and be explicit about which side you're on.** This is where a float-vs-integer money bug will be born if one is born.

**4.2 Two places already bypass `money.ts` and hardcode `/100`** — `src/features/inventory/presenters.ts:61` and `:66` (`Math.round(item.salePriceMinor / 100)`), which the header comment in `money.ts` explicitly forbids. Fix them while you're in the pricing code, or the next currency (SAR, KWD with exponent 3) silently produces wrong numbers.

**4.3 `autoFocus` fires on every rendered line row** (`DocLineRow.tsx:68`), not just the newest. On a 10-line document that's a focus fight. Fix when you touch the row — a negotiated-price flow that steals focus to line 1 every re-render will be unusable.

**4.4 The barcode path does not re-read price on a repeat scan** (`useDocumentForm.ts:172-190`) — it bumps `qty` instead. Correct behaviour, and it must stay correct once the price is editable: scanning the same item twice after you've negotiated its price down must **not** reset the price to list.

---

## 5. Is it worth it?

**Yes. Build this first, before the other three.**

- **Cost:** ~1 hour for the boolean + labels (which alone delivers the literal request). ~1 day for the full margin strip, price floor, and `pricing_mode` flag.
- **Value:** this is not a nice-to-have; it's a **correctness gap in the core loop**. A retail app for a haggling market that cannot record the price the goods actually sold for is recording *fiction*. Every downstream number — monthly profit, margin, "am I making money" (the question `docs/PROJECT.md` says the app exists to answer) — is wrong by exactly the amount of the discount. Right now the app assumes every sale happens at list price. In a men's clothing shop in an Arabic market, almost none do.
- **Risk:** low. One migration adding two nullable/defaulted columns. `migrate.ts` already has an idempotent `addColumnIfMissing()` helper (`migrate.ts:108-125, 131-142`) built for exactly this.

**The strongest argument:** you are not building a feature. You are un-breaking one that is already 90% written and one character away from working.

---

## 6. Definition of done

- [ ] `DocLineRow.tsx:35` inverted gate fixed; `documents.unitPrice` / `documents.unitCost` labels corrected
- [ ] Stale `useState` import, dead pencil comments, and the L53 TODO removed
- [ ] `autoFocus` fires only on the newest line
- [ ] Sale line price is editable; barcode re-scan does not reset a negotiated price
- [ ] Live margin strip: list price, cost, profit, colour-coded (amber < target, red < cost)
- [ ] `items.pricing_mode` (`'fixed' | 'negotiable'`) + `items.min_price` via `addColumnIfMissing`
- [ ] Below-cost save shows a confirm, never a block
- [ ] `presenters.ts:61,66` routed through `money.ts` instead of hardcoded `/100`
- [ ] Verified: a negotiated sale does **not** mutate `items.salePrice` for an existing item
- [ ] Verified: monthly profit on the dashboard reflects the negotiated price, not the list price

## 7. Later

- **Last-price-for-this-customer** chip (needs a `document_lines` join on `documents.party_id`; index it).
- **Bulk/tier pricing** — qty ≥ 10 → different price. Common in clothing. Natural extension of `pricing_mode`.
- **Discount as a first-class column** — today a discount is invisible: the line just stores a lower `unitPrice`. If you ever want "how much did I give away in discounts this month", you need `list_price_at_sale` stored on the line. **Cheap to add now, impossible to backfill later.** Strongly consider adding `document_lines.list_price` in the same migration — one integer column buys you the entire discount-analytics story for free.
