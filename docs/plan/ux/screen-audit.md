# Screen Audit — Step-1 Hot Path

> Per-screen two-hill scores (`Speed 0–3 / Safety 0–3`) against the rubric in `README.md`, with **concrete, file-named fixes** — the prop / className / handler to change and why. No vibes.
> Findings ranked **most-impactful first** across all screens. Reconciles with `../ux-review-design-prototype.md` (web-mock review) where noted; that doc reviews the prototype, this reviews the shipping RN code.

Files audited (real, current):
`src/features/inventory/screens/ItemsListScreen.tsx`, `.../HomeScreen.tsx`, `.../ItemMovementScreen.tsx`,
`src/features/inventory/components/ItemFormSheet.tsx`, `.../ItemRow.tsx`, `.../drafts.ts`,
`src/features/documents/components/DocumentForm.tsx`, `.../LineItemPicker.tsx`, `.../DocLineRow.tsx`, `.../PartyPicker.tsx`,
`src/components/ui/LabeledInput.tsx`, `.../SearchBar.tsx`, `src/utils/numerals.ts`, `src/utils/money.ts`.

## Score summary

| Screen / component | Speed | Safety | Worst offense |
|---|:---:|:---:|---|
| **DocumentForm** | 1 | **0** | Whole document in `useState`; no draft/restore |
| **DocLineRow** | **0** | 1 | Qty stepper-only; price-edit is a no-op → purchase cost unenterable |
| **ItemFormSheet** | 2 | **0** | Save is an external stub; edit blanks cost/barcode |
| **ItemsListScreen** | 2 | **0** | Passes `onSave={() => setFormOpen(false)}` — items never persist |
| **LineItemPicker** | 1 | 2 | Substring-only search; closes after every pick |
| **PartyPicker** | 2 | 2 | Solid; minor (no autofocus, walk-in default) |
| **HomeScreen** | 3 | 3 | Static demo data (expected pre-wiring) |
| **ItemMovementScreen** | 3 | 3 | Read-only; fine |

---

## TOP FINDINGS — ranked by impact

### #1 — DocumentForm: the in-progress document can vanish (Safety 0)
**File:** `src/features/documents/components/DocumentForm.tsx`
**What:** `lines`, `party`, `chosen` are `useState` only. A backgrounded/killed app or crash loses a fully entered multi-line document. No draft persistence, no restore.
**Fix:**
- Persist the editor as a **draft document** (`status: 'draft'`) in SQLite via `documentRepository`, debounced 500–800 ms + forced flush on `AppState` background and on every add/remove-line. See `never-lose-data.md` §1–4.
- On mount, load an existing draft of this `type` and show a dismissible "استُعيدت مسودة" banner.
- Keep totals derived (don't persist `total`).
**Why:** All-day entry + OS memory pressure = guaranteed eventual loss. This is the single highest-value fix and the whole reason Hill 2 exists.

### #2 — DocLineRow: purchase unit-cost is impossible to enter (Speed 0, blocker)
**File:** `src/features/documents/components/DocumentForm.tsx` (`appendItem`, `onEdit={() => {}}`) + `src/features/documents/components/DocLineRow.tsx`
**What:** `appendItem` sets `unitPrice = 0` for `mode === 'purchase'`, and the row's edit button is wired to a **no-op** (`onEdit={() => {}}`). There is **no path** to type what was paid → every incoming document posts cost = 0 → weighted-average cost and all future COGS are wrong.
**Fix:**
- Make `DocLineRow`'s rate line a `TextInput` (`keyboardType="decimal-pad"`, `selectTextOnFocus`) bound to a real `onPriceChange(id, value)` handler in `DocumentForm` (replace the empty `onEdit`).
- Prefill purchase `unitPrice` from `item.costPrice` (last-known cost) instead of `0`.
**Why:** A field the owner can't fill (anti-pattern A5) that also corrupts valuation. Correctness + speed in one.

### #3 — ItemFormSheet + ItemsListScreen: new items are never saved (Safety 0)
**Files:** `src/features/inventory/screens/ItemsListScreen.tsx`, `src/features/inventory/components/ItemFormSheet.tsx`
**What:** The list passes `onSave={() => setFormOpen(false)}` — the `draft` argument is discarded; nothing reaches `itemRepository`. The owner fills the form, taps Save, and the item silently disappears.
**Fix:**
- In `ItemsListScreen`, implement `onSave={(draft) => { itemRepository.create(fromDraft(draft)); reload(); setFormOpen(false); }}` (add a `fromDraft` mapper mirroring `toDraft`, converting major→minor via `toMinor`).
- Reload the list (`useItems().reload`) after write so the new row appears.
**Why:** Anti-pattern A1 — a Save button that drops data. Nothing typed should ever be lost.

### #4 — Item cost & barcode are dropped on edit (Safety 0) — deeper than a hardcode
**Files:** `src/features/inventory/types.ts`, `src/features/inventory/mappers.ts`, `src/features/inventory/drafts.ts`
**What:** `toDraft(item)` returns `costPrice: ''` and `barcode: ''` — **not by mistake, but because it has nothing to read**: the `InventoryItem` view-type (`types.ts`) exposes only `salePriceMinor`, `qty`, `lowStockThreshold` — it carries **no `costPriceMinor` and no `barcode` at all**, and `mappers.ts` never maps them. So open an item → the edit form shows blank cost/barcode → Save writes those blanks back → the stored cost price and barcode are lost.
**Fix (in order):**
1. `types.ts` — add `costPriceMinor: number` and `barcode: string | null` to `InventoryItem`.
2. `mappers.ts#toInventoryItem` — map them from the row (`costPriceMinor: row.costPrice`, `barcode: row.barcode`) alongside the existing `salePriceMinor: row.salePrice`.
3. `drafts.ts#toDraft` — then populate: `costPrice: toMajor(item.costPriceMinor)`, `barcode: item.barcode ?? ''`.
**Why:** Anti-pattern A2 — an edit that destroys fields the owner never touched. The `''` in `toDraft` is a symptom; the missing type/mapper plumbing is the root cause. Ships together or the fix is cosmetic.

### #5 — DocLineRow: quantity is stepper-only (Speed 0)
**File:** `src/features/documents/components/DocLineRow.tsx`
**What:** Qty changes only via `onInc`/`onDec` (`mutateQty(id, ±1)`). Entering qty 48 = 47 taps. This is the hottest field in the app.
**Fix:** Replace the center `<Text>{formatNumber(line.qty)}</Text>` with a `TextInput` (`keyboardType="decimal-pad"`, `text-center`, `selectTextOnFocus`) bound to `onQtyChange(id, value)`. Keep `+`/`−` as fine-adjust. Also bump the `w-9 h-9` (36px) stepper/edit/delete buttons to `w-11 h-11` (44px) per Hill 1 §6.
**Why:** Anti-pattern A4 + A7. Direct entry is the biggest per-document tap saving on the hot path.

---

## Per-screen detail

### HomeScreen — Speed 3 / Safety 3
**File:** `src/features/inventory/screens/HomeScreen.tsx`
- **Good:** Quick-action row (new outgoing / new incoming / scan) puts the two money loops one tap from home; large `basis-[30%]` tiles; consistent `ROW` RTL; Arabic-Indic `formatNum`.
- **Watch:** All figures are `DEMO` constants — expected before repo wiring, but don't ship demo numbers as if live. Wire `inventoryValue`/`lowStockCount` to repo queries.
- **Nit:** The Home "scan" quick-action routes to `ScanScreen`, which is `UnderConstruction`. Either gate it behind Step 7 or label it clearly (see #dead-scan below).
- No data entry here → nothing to slow down or lose. Keep as the fast launcher it is.

### ItemsListScreen — Speed 2 / Safety 0
**File:** `src/features/inventory/screens/ItemsListScreen.tsx`
- **Good:** Search + filter chips + `+` header action; empty-state with reset; clean composition.
- **Safety 0:** the stub `onSave` (finding #3).
- **Speed fixes:**
  - `SearchBar onScanPress={() => {}}` is a **dead button** (anti-pattern A3). Wire to the scanner or hide until Step 7.
  - **Edit is only long-press** (`onLongPress={() => openEdit(item)}`) with no visual hint — undiscoverable. Add a visible edit affordance or a tap→detail→edit path.
  - Search is `item.name.includes(q)` (via `useItemFilter`) — case/diacritic-sensitive, name-only. Make fuzzy + barcode (Hill 1 §5).
  - Uses `ScrollView`+`map`; fine for Step-1 volumes, but switch to `FlatList` if item counts grow (virtualization).

### ItemFormSheet — Speed 2 / Safety 0
**File:** `src/features/inventory/components/ItemFormSheet.tsx`
- **Good:** `keyboardType="numeric"` on all money/threshold/barcode fields; `canSave` gate; clean draft-local state.
- **Safety 0:** depends on the caller's stub Save (#3) and the `toDraft` blanking bug (#4). Also no MMKV draft backup for the sheet (never-lose-data §3).
- **Speed fixes:**
  - No `autoFocus` on the name field → keyboard closed on open, one wasted tap. Add `autoFocus`.
  - No `returnKeyType`/`onSubmitEditing` → no focus advance. Thread name→cost→sale→threshold→barcode (needs `LabeledInput` to accept those props — see below).
  - Switch `keyboardType="numeric"` → `decimal-pad` (money) / `number-pad` (barcode).
  - No `KeyboardAvoidingView` — on a small screen the keyboard covers the Save button (anti-pattern A12). Wrap the sheet body.
  - Default `category: 'tshirts'` / `unit: 'piece'` hardcoded — use last-used (Hill 1 §7).

### LabeledInput (shared) — enables the fixes above
**File:** `src/components/ui/LabeledInput.tsx`
- Add pass-through props: `autoFocus`, `returnKeyType`, `onSubmitEditing`, `selectTextOnFocus`, `maxLength`, and an optional numeric `sanitize` (strip non-digits like `AddExpenseSheet` does). Today it only forwards `keyboardType`. Every form field improvement rides on this component.

### LineItemPicker — Speed 1 / Safety 2
**File:** `src/features/documents/components/LineItemPicker.tsx`
- **Good:** Bottom-sheet, on-hand + price per row, real repo items.
- **Speed fixes:**
  - **Closes after every pick** (`onSelect` → `close()`) — adding N items = N sheet re-opens (anti-pattern A6). Keep open on select, clear the query, keep focus; add a footer "تم" to dismiss (Hill 1 §3).
  - Search `i.name.includes(q)` — substring/case-sensitive, ignores barcode. Make fuzzy + barcode (Hill 1 §5).
  - Search input has no `autoFocus` — add it so the keyboard is up on open.

### DocumentForm — Speed 1 / Safety 0
**File:** `src/features/documents/components/DocumentForm.tsx`
- **Good:** Save is **always one tap** (header check **and** sticky bottom button) — exemplary Hill-1 behavior. Negative-stock guard surfaces `NegativeStockError` cleanly. Supplier-debt hint shown (AP), customers correctly carry no balance (matches the locked "sales are cash, no AR" rule).
- **Safety 0:** finding #1 (no draft/restore); posts straight to `status: 'posted'`.
- **Speed fixes:**
  - Hardcoded date `6/7/2026` with a non-functional calendar icon (anti-pattern A11) — wire an RTL date picker defaulting to today (reconciles `ux-review` gap #4).
  - "مسح" (scan) button just opens the item picker (`onPress={() => setItemPickerOpen(true)}`) with a barcode-scan icon implying a camera — misleading. Honest label until Step 7.
  - `DEMO_CUSTOMERS`/`DEMO_SUPPLIERS` are in-file constants — wire to the party repo (Step 2), acceptable for now.
  - Confirm `documentRepository.create` wraps header + lines + ledger in one transaction (never-lose-data §5).

### DocLineRow — Speed 0 / Safety 1
**File:** `src/features/documents/components/DocLineRow.tsx`
- Findings #2 (no-op price edit), #5 (stepper-only qty), plus:
- **Delete is immediate** (`onDelete` → `removeLine`) with no undo (anti-pattern A8, `ux-review` gap #5). Add an undo-toast (never-lose-data §6).
- Tap targets `w-9 h-9` = 36px throughout — bump to 44px.
- The edit button's `accessibilityLabel={t('common.save')}` is wrong (it's an edit control) — fix label.

### PartyPicker — Speed 2 / Safety 2
**File:** `src/features/documents/components/PartyPicker.tsx`
- **Good:** Search by **name OR phone**, walk-in shortcut, quick-add on no-match, debt hint per row — this is the pattern `LineItemPicker` should copy (and it closes `ux-review` gap #1, the missing existing-party search).
- **Speed nits:** search input lacks `autoFocus`; closes on select (acceptable here — one party per doc, unlike items). Keep.

### ItemMovementScreen — Speed 3 / Safety 3
**File:** `src/features/inventory/screens/ItemMovementScreen.tsx`
- Read-only chronological ledger with on-hand header and running balance; Arabic-Indic digits; empty-state. Tapping a row nav to `Documents` (should deep-link the specific doc once routing supports it — minor). Nothing to type, nothing to lose. Good.

---

## Cross-cutting (applies to multiple files)

- [ ] **`LabeledInput` prop expansion** (autoFocus / returnKeyType / onSubmitEditing / selectTextOnFocus / maxLength / sanitize) — unblocks focus-advance and keypad hygiene across every form.
- [ ] **Digit-fold on input** in `money.ts` (`٠-٩ → 0-9`) before `toMinor`/parse — protects against Arabic-Indic digits arriving from paste/HID (Hill 1 §11).
- [ ] **44px tap targets** — sweep every `w-8 h-8`/`w-9 h-9` pressable on the hot path (DocLineRow, sheet close buttons).
- [ ] **Kill or gate dead scan buttons** — `ItemsListScreen` `onScanPress`, `DocumentForm` scan button, Home scan tile all lead to no scanner (`ScanScreen` = UnderConstruction). Honest until Step 7.
- [ ] **Undo, not immediate delete** — DocLineRow line delete, item archive.
- [ ] **One transaction per post** — verify in `document-repository`.
