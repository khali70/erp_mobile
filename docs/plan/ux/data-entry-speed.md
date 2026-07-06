# Hill 1 — Data-Entry Speed Playbook

> Checkable Definition-of-Done for every field, form, and picker on the Step-1 hot path.
> Grounded in the current code: `ItemFormSheet`, `DocumentForm`, `LineItemPicker`, `DocLineRow`, `LabeledInput`, `SearchBar`.
> Reference implementation to copy: **`src/features/expenses/components/AddExpenseSheet.tsx`** already does `keyboardType="number-pad"` + input sanitize (`onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}`). Match that everywhere money/qty is typed.

---

## 1. Keyboard type & input sanitizing

- [ ] Every **money** field uses `keyboardType="decimal-pad"` (allows the fractional pound) — `ItemFormSheet` cost/sale price, `DocLineRow` inline price.
- [ ] Every **quantity** field uses `keyboardType="decimal-pad"` (kg is fractional — see `data-model.md`, qty is `REAL`).
- [ ] Every **barcode** field uses `keyboardType="number-pad"` — currently `ItemFormSheet` barcode is `keyboardType="numeric"`; number-pad is the tighter keypad.
- [ ] **Name** fields keep the default text keyboard (correct today).
- [ ] `LabeledInput` gains an optional `sanitize`/`inputMode` so numeric fields strip non-digits on change, like `AddExpenseSheet` does inline. Today `LabeledInput` passes `keyboardType` through but does **no** sanitizing — a paste or hardware keyboard can inject letters into a price.
- [ ] `keyboardType="numeric"` is **banned** for new fields — it renders a full keyboard with a number row on Android, not a keypad. Use `decimal-pad` (money/qty) or `number-pad` (barcode/count).

## 2. Focus behavior — auto-advance, auto-focus

- [ ] The **first field of every add-form auto-focuses** on open so the keyboard is already up: `ItemFormSheet` name field needs `autoFocus`; `LineItemPicker` and `PartyPicker` search inputs need `autoFocus` (today the owner must tap the field first — one wasted tap per open).
- [ ] `LabeledInput` accepts `returnKeyType` and `onSubmitEditing` so **Enter jumps to the next field**. Wire the `ItemFormSheet` chain: name → cost → sale → threshold → barcode, last field `returnKeyType="done"`.
- [ ] Numeric fields set `selectTextOnFocus` so re-editing a price **selects-all** instead of forcing the owner to backspace a remembered value.
- [ ] Money/count fields set a sane `maxLength` to prevent fat-finger runaway (e.g. barcode ≤ 14).

## 3. Add-line flow — the core loop (DocumentForm + LineItemPicker)

- [ ] Adding a line **must not force a picker round-trip per item.** Today `LineItemPicker.onSelect` calls `close()` after every pick — adding 5 items = opening the sheet 5 times. Keep the sheet open on select; append the line and clear the search so the owner keeps typing the next item.
- [ ] Selecting an item **keeps focus in the search box** (don't dismiss the keyboard) so a rapid name→name→name entry never touches the keypad toggle.
- [ ] Show a running "**N added**" affordance + a single "تم" (done) button in the picker footer to dismiss when finished, instead of dismiss-on-each-tap.
- [ ] After add, the new line should be **inline-editable for qty and price** without opening anything — see §4.
- [ ] "إضافة صنف" (add-line) button stays visible with the keyboard up (sticky footer or `InputAccessoryView`), so the loop never requires scrolling.

## 4. Quantity & price entry — kill the stepper-only trap

- [ ] `DocLineRow` qty must be a **typable field**, not `+`/`−` only. Today qty changes solely via `onInc`/`onDec` (`mutateQty(id, ±1)`); entering "48" is 47 taps. Make the center number a `TextInput` (`keyboardType="decimal-pad"`), keep `+`/`−` as fine-adjust.
- [ ] `DocLineRow` **price/cost must be editable inline.** Today `onEdit={() => {}}` is a **no-op** (`DocumentForm` passes an empty handler) and the edit button does nothing. On **incoming/purchase this is a blocker**: `appendItem` sets `unitPrice = 0` for purchase and there is no other way to type the cost — the owner literally cannot record what they paid. Make the rate line a `TextInput`.
- [ ] Qty stepper `+`/`−` targets are **≥ 44px** — see §6.
- [ ] Line total recomputes live as qty/price change (already the pattern: `total = unitPrice * qty`).

## 5. Search — instant & fuzzy, name + barcode

- [ ] Item search matches **name OR barcode**. Today `LineItemPicker` and `useItemFilter` use `item.name.includes(q)` — barcode is ignored, so a scanned/typed code finds nothing.
- [ ] Search is **case- and diacritic-insensitive**. `String.includes` is exact; normalize both sides (strip Arabic tashkeel, fold Latin case) before compare.
- [ ] Search is **debounced-free / synchronous** — the list is local SQLite, so filter on every keystroke with no spinner (keep the current synchronous `useMemo`; never introduce an async spinner here).
- [ ] Party search already matches name **or** phone (`PartyPicker`) — keep; extend the same OR pattern to items.

## 6. Tap targets — one-thumb, ≥ 44 px

- [ ] `DocLineRow` qty stepper buttons are `w-9 h-9` = **36px** → bump to `w-11 h-11` (44px).
- [ ] `DocLineRow` edit/delete buttons are `w-9 h-9` = 36px → 44px.
- [ ] `ItemFormSheet` / `PartyPicker` / `LineItemPicker` close buttons are `w-8 h-8`/`w-9 h-9` (32–36px) → 44px (or enlarge the pressable hit-slop via `hitSlop`).
- [ ] Primary actions (Save, Add-line, Add-party) are already comfortably tall (`py-3.5`/`py-4`) — keep.
- [ ] Hot-path controls sit in **thumb reach** (bottom third): Save is bottom-of-scroll and header — good; keep the sticky bottom Save.

## 7. Defaults & last-used (remembered values)

- [ ] `ItemFormSheet` remembers **last-used unit and category** as the default for the next new item (currently hardcoded `category: 'tshirts'`, `unit: 'piece'`). Persist last-used via the settings/MMKV store (see `never-lose-data.md`).
- [ ] Document **date defaults to today** and is editable. Today `DocumentForm` renders a **hardcoded `6/7/2026`** with a non-functional calendar icon — it is neither today nor tappable. Wire an RTL date picker (reconciles with `ux-review` gap #4).
- [ ] Document **store defaults** to the single Main Store silently (fine now — only one store in Step 1) but must not be a fake dropdown implying choice.
- [ ] Incoming line **unit cost prefills from the item's last-known cost**, not `0`, so a re-purchase is one confirm. Sale already prefills `salePriceMinor` in `appendItem`; mirror it for purchase — but note the `InventoryItem` view-type has **no `costPriceMinor` yet** (see `screen-audit.md` #4): add it to `types.ts` + `mappers.ts` first, then prefill from it.
- [ ] `lowStockThreshold` default (`'10'`) is reasonable; keep, but make it the last-used value once the owner changes it.

## 8. Scan-to-add — make the button real (reconciles ux-review gap: "barcode offered, never required")

- [ ] `ItemsListScreen` `SearchBar onScanPress={() => {}}` is a **dead no-op** — either wire it to the scanner or hide it until Step 7. A dead button is worse than no button.
- [ ] `DocumentForm` "مسح" (scan) button opens the **item picker**, not a scanner (`onPress={() => setItemPickerOpen(true)}`), and `ScanScreen` is an `UnderConstruction` skeleton. Until the camera lands (Step 7 per `step-1-simple-store.md`), **label it honestly** or route both buttons to the same picker without the barcode-scan icon implying a camera.
- [ ] When scan lands: a successful scan **appends the matched line and keeps the scanner open** for the next item (same no-dismiss rule as §3).
- [ ] Scan is **additive, never required** — every scannable path has a type/search fallback (already true via the picker).

## 9. Modals & Save — minimal, always-available

- [ ] **Save is always one visible tap.** `DocumentForm` has both a header check action and a sticky bottom Save — good, keep both. `ItemFormSheet` Save is inside the scroll — ensure it stays reachable with the keyboard up (§10).
- [ ] No dead-end confirmations on the happy path. Post-save uses `Alert.alert(... saved ...)` with a single OK that navigates back — acceptable, but a non-blocking toast + auto-dismiss is faster for all-day entry.
- [ ] Disabled-Save communicates *why* (e.g. "add at least one line") rather than silently doing nothing. `DocumentForm` already alerts on empty lines — keep; `ItemFormSheet` greys Save when name/price empty — add a hint.

## 10. Keyboard-avoidance

- [ ] Every form with inputs below the fold wraps content in `KeyboardAvoidingView` (or keeps Save in an `InputAccessoryView`). None of the current sheets do — on a small phone the keyboard can cover `ItemFormSheet`'s Save button and the `DocumentForm` summary.
- [ ] The add-line button and running total stay visible above the keyboard during rapid entry (ties to §3 sticky footer).

## 11. RTL & Arabic numeric entry

- [ ] **Display uses Arabic-Indic digits** (`toArabicDigits` / `formatNumber`) — already correct across `DocLineRow`, `ItemRow`, `HomeScreen`, movement.
- [ ] **Input stays Latin digits** — `keyboardType="decimal-pad"`/`number-pad` emits `0-9`; the field shows what the OS keypad types. This is the intended split (type Latin, display Arabic-Indic): do **not** try to render Arabic-Indic glyphs *inside* an editable `TextInput` — it breaks caret math and re-parsing.
- [ ] Numeric `TextInput`s keep `text-right` (they do) so the caret sits on the correct side in the RTL form.
- [ ] Parse on the way in with a **digit-fold** helper: if an Arabic-Indic digit ever arrives (hardware keyboard / paste), map `٠-٩ → 0-9` before `toMinor`/`parseFloat`. `money.ts` should own this normalize step; today `toMinor` assumes Latin.
- [ ] Thousands separator in **display** is `٬` (already via `numerals.ts`); never inject it into an editable field.
- [ ] Row layout uses the `ROW` helper (`src/theme/rtl.ts`) consistently — audit passes; keep using `ROW`, never a raw `flex-row`.

---

### Per-screen Speed score (see `screen-audit.md` for the diffs)
| Screen | Speed | One-line reason |
|---|---|---|
| HomeScreen | 3 | Quick-action shortcuts, big targets, no data entry to slow down |
| ItemsListScreen | 2 | Fast list + search, but dead scan button and hidden long-press-to-edit |
| ItemFormSheet | 2 | Keypad on prices, but no auto-focus/advance, no keyboard-avoid |
| LineItemPicker | 1 | Substring-only search, no autofocus, **closes per item** |
| DocLineRow | 0 | Qty stepper-only, price edit is a no-op → purchase cost unenterable |
| DocumentForm | 1 | Save always visible, but hardcoded date, dead scan, can't enter cost |
| ItemMovementScreen | 3 | Read-only; nothing to type |
