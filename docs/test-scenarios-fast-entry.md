# Test Scenarios — Dynamic Categories, Tags, Rich Items, Field Locks, Fast Entry

Manual QA script for the **v1** feature set (plan `make-taga-as-list-dynamic-willow`).
Two hills every scenario protects: **speed of data entry** and **never lose data**.

Legend: 🟢 happy path · 🟡 edge case · 🔴 data-loss / correctness guard

Devices: physical Android (SM-G781W, 1080×2400) + in-memory jest DB for repo layer.
Language: run each once in **AR** (default, RTL) and spot-check **EN**.

---

## A. Dynamic categories

### A1 🟢 Seeded categories appear
1. Fresh install → open **البضائع** (Goods) → tap **إضافة بضاعة** (Add item).
2. Open the category select.
- **Expect:** 7 seeded categories (tshirts, jackets, shoes, pants, shirts, accessories, other), each with its own color avatar + localized label.

### A2 🟢 Add a category inline
1. In the category select, tap **＋ تصنيف جديد** (New category).
2. Type `شنط` (bags) → confirm.
- **Expect:** row inserted, immediately selectable, chip gets the fallback (slate) color. No app restart needed.
3. Save the item with the new category.
- **Expect:** item persists with `category = "شنط"`; reopening the form shows it selected.

### A3 🟡 Duplicate category name
1. Add category `شنط` again (already exists).
- **Expect:** no duplicate row, no crash. `categoryRepository.create` returns the existing row (insert-or-return on UNIQUE name).

### A4 🟡 Label resolution
- Seeded category (has `i18n_key`) → shows translated label and follows AR/EN switch.
- User-added category (null `i18n_key`) → shows the raw typed name verbatim in both languages.

### A5 🔴 Unknown / null category color
- Item whose `category` matches no registry row (or is empty) → avatar shows **fallback** style, never crashes / blank.

---

## B. Tags (registry + string[])

### B1 🟢 Add tags to an item
1. Edit an item → in **الوسوم** (Tags) type `صيفي` press return, `قطن` press return.
- **Expect:** two removable chips. Save.
2. Reopen the item.
- **Expect:** both chips restored (persisted as JSON `string[]`, parsed back on read).

### B2 🟢 Tag autocomplete / registry grows
1. Add tag `صيفي` to item A, save.
2. Open item B tags → start typing `صي`.
- **Expect:** `صيفي` offered as a known-tag suggestion (registry `upsertMany` ran on A's save).

### B3 🟡 Duplicate / whitespace tag
- Adding a tag already on the item → no dupe chip.
- Trailing spaces trimmed before add; empty/blank not added.

### B4 🔴 Tags never join per query
- Confirm item list still loads with zero extra joins (tags read from the denormalized column, registry only feeds autocomplete).

---

## C. Notes + rich item

### C1 🟢 Notes persist
1. Edit item → **ملاحظات** (Notes) multiline → type 2 lines → save → reopen.
- **Expect:** text restored verbatim, multiline preserved.

### C2 🟢 Full rich item round-trip
- Create item with: name, category, ≥2 tags, notes, cost ("price on me"), photo, stock → save → reopen.
- **Expect:** every field restored.

---

## D. Generic field lock (any field)

### D1 🟢 Lock survives reset
1. Fast-entry row: set category + price + qty, tap the 🔒 on each.
2. Add a line.
- **Expect:** title (unlocked) clears + refocuses; category/price/qty (locked) **keep their values**.

### D2 🟢 Unlock restores default-clear
1. Unlock price (🔓) → add another line.
- **Expect:** price now clears on reset like a normal field.

### D3 🔴 Locks survive app kill (never-lose-data)
1. Lock category + price, type a partial title, **do not** add the line.
2. Force-kill the app → relaunch → reopen the same New document.
- **Expect:** the in-progress quick row **and** its lock state are restored from the draft buffer (MMKV). Nothing retyped.

### D4 🟡 Lock any field, not just price/qty
- Repeat D1 locking **tags** and **note** instead → those persist across adds, others clear. Confirms the lock is generic.

---

## E. Fast entry (find-or-create write path)

### E1 🟢 Toggle fast entry
1. New Incoming → tap **إدخال سريع** (Fast entry) segment.
- **Expect:** QuickEntryRow renders: category chips + title(autocomplete) + price + qty + tags + note, each wrapped in a LockableField. **From list** shows the add/scan buttons instead.

### E2 🟢 Rapid multi-line entry
1. Lock category + price + qty. Type 5 distinct titles, pressing return/＋ after each.
- **Expect:** 5 lines added; only title cleared each time; ~1 keystroke-field per line after the first. Item count + total update live.

### E3 🔴 Find-or-create: retype existing name → stock accumulates
1. Add line title `قميص أبيض` qty 3, save the document.
2. New document → fast entry → title `قميص أبيض` (same category) qty 2, save.
- **Expect:** **one** item record for `قميص أبيض`; stock accumulates (3 → 5). **No** duplicate item. Matching uses normalized `nameKey` (lowercased/trimmed) + category.

### E4 🟡 Same name, different category
- `قميص أبيض` under category A vs category B → **two** distinct items (identity is name **+** category).

### E5 🟡 Typo guard
- `قميص ابيض` vs `قميص  أبيض` (extra space) → normalization collapses whitespace/case so intended matches merge; genuinely different spelling stays separate (documented limitation, mitigated by autocomplete).

### E6 🔴 Line provenance persisted
- After save, the `document_lines` row carries `title` / `note` / `image_uri`; `item_id` still points at the resolved ledger item.

### E7 🟢 Sale side
- Repeat E1–E2 on **New Outgoing** (sale) → fast entry uses **sale price** on create; purchase uses **cost price**.

---

## F. Draft safety (never-lose-data) — cross-cutting

### F1 🔴 Restore banner
- Enter a quick line, background/kill app, relaunch → **RestoredDraftBanner** shows; lines + quick + locks restored.

### F2 🟢 Discard draft
- Tap discard → quick values, locks, and lines all reset to empty defaults.

---

## G. Regression / build gates

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx eslint` clean (1 pre-existing DocLineRow useState warning allowed).
- [ ] `npx jest` — all repo tests green (`item-repository`, `document-repository`, category/tag).
- [ ] Cold boot on device: migration runs additive-only, no SQLite/crash in logcat.
- [ ] Existing catalog items (pre-migration) load with tags defaulting to `[]`, notes null.

---

## Deferred (NOT in v1 — do not test yet)
- **v2** Sales isolation: `SaleItem` projection + `listWithStockForSale()` + ESLint module boundary (sale path must not see cost).
- **v3** Staff roles on top of the projection.
