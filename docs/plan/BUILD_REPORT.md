# Step-1 Build Report

Branch: `step-1/autonomous-build` (never pushed, `main` untouched).
Gates every slice: `tsc --noEmit` clean + `eslint src` 0 errors. Jest skipped
per instruction ("skip tests"). Verified end-to-end on a physical Android
device via adb.

## What shipped

Step-1 scope — inventory items + incoming/outgoing ledger + computed on-hand +
stock movement — is functionally complete and device-verified.

- **Items**: list from SQLite (`useItems` → `itemRepository.listWithStock`),
  search/filter, stock badges, add/edit via `ItemFormSheet` (now actually
  persists; carries cost + barcode both ways), image via expo-image-picker.
- **Documents**: `DocumentForm` (sale/purchase) posts to the ledger via
  `documentRepository.create({status:'posted'})`; real item picker
  (`LineItemPicker`); typable qty **and** unit cost/price; `DocumentsListScreen`
  wired to the repo with in/out filter; New{Incoming,Outgoing} screens + routes.
- **Ledger / stock**: on-hand = Σ(qty × direction) over posted lines;
  `ItemMovementScreen` shows chronological entries with a running balance and
  source doc no; negative stock blocked by default behind `allowNegativeStock`
  (Settings toggle, persisted to MMKV).
- **Two hills**:
  - *Speed of entry* — one-tap add-line, typable numeric fields (decimal-pad),
    prefilled sale price, 44px touch targets.
  - *Never lose data* — all writes in a single transaction; posted docs are
    append-only; soft-delete only; **crash-safe document draft** mirrored to
    MMKV and restored on relaunch.
- **Product rule (locked)**: NO customer debt (AR). Sales are always cash, paid
  in full; debt exists only with suppliers (AP). Removed the sale-side
  paid/remaining UI, the Home "Owed to you (customers)" KPI, and the
  credit-invoices banner.

## Bugs found & fixed during the device pass

1. **First-boot crash** — `runMigrations` opened a second `openDatabaseSync`
   handle that raced the change-listener handle → `prepareSync`
   NullPointerException. Now reuses the single shared connection; dropped the
   redundant WAL PRAGMA. (`919bd3f`)
2. **Post crashed: "Failed to run the query 'begin'"** — `create()`'s
   transaction called `post()`, which opened a nested transaction; expo-sqlite's
   sync driver has no savepoint nesting. Extracted `postInternal()` (no tx);
   one BEGIN per write. (`e48b9da`) *(Unit tests missed this — their driver
   nests via savepoints.)*
3. **Seed wiped on first posting** — seed wrote `stock_levels` directly (no
   ledger rows), so the first recompute zeroed it. Seed now posts a ledger-backed
   opening-balance incoming document per item. (`919bd3f`)
4. **UX-audit correctness bugs** (`ed1e863`): new/edited items were never
   persisted; purchase unit cost couldn't be entered (posted cost 0, corrupting
   weighted-average valuation); editing wiped cost & barcode; qty was
   stepper-only.

## Device verification (adb, physical device)

Fresh install (`pm clear`) → boots clean (no migration crash). Then:

- T-shirt seeded on-hand **24** (ledger-backed IN-000001 +24).
- Post incoming +5 → on-hand **5** (on the pre-seed DB) / +5 over seed after fix.
- Post outgoing −3 → on-hand **2**; movement lists IN +5 (bal 5) and OUT −3
  (bal 2) with correct running balance and direction tint.
- Oversell (qty 10 > on-hand 5) → **blocked**: "Requested quantity exceeds
  available stock"; input preserved.
- Enter a line → force-stop mid-entry → relaunch → **draft restored** with a
  "Restored an unsaved draft / Discard" banner.
- Home shows only "You owe (suppliers)"; no customer-debt tile.

## UX plan docs

`docs/plan/ux/` — two-hills manifesto + anti-patterns + scoring rubric,
data-entry-speed playbook, never-lose-data contract, per-screen audit with
file-named fix diffs (the source of bugs #1–#4 above).

## Open items / next actions

- **i18n language**: follows device locale with Arabic fallback (Arabic-first is
  correct on an Arabic device). The English test phone renders English UI with
  Arabic-Indic numerals — expected, not a bug.
- **Draft scope**: the crash-safe buffer covers documents. The item form sheet
  (`ItemFormSheet`) is not yet buffered — lower risk (single short form), but a
  candidate for the same treatment.
- **RTL layout squeeze** in `DocLineRow` on an LTR device (label/field overlap)
  is cosmetic; tidy the row when polishing.
- **Out of Step-1**: cashbook, scan, parties, reports screens remain
  `UnderConstruction` (Step 2/3).
- Tests were skipped this session by instruction; the transaction-nesting bug
  argues for at least one integration test that runs `create({status:'posted'})`
  against the real expo-sqlite driver (not just the savepoint-nesting test one).
