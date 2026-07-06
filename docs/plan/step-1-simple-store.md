# Step 1 — Simplest Working Store (Inventory + Incoming/Outgoing Ledgers)

> Cloning the StockManagement-style app `com.stockmanagment.next.app` ("الجرد والمخزون ببساطة").
> This document is the **entire scope of Step 1**. Offline-first, single local store, Arabic RTL from day one.
> Architecture conforms to `/Users/khali/Code/erp_mobile/AGENTS.md`.

---

## 1. Goal & Non-Goals

### Goal (what Step 1 MUST do)
- **Manage items (Goods / البضائع):** create, edit, list, delete an item with name, optional barcode, unit, cost price, sale price, optional image.
- **Incoming documents (الوارد):** create a goods-in document (header + lines). Posting it **adds** stock.
- **Outgoing documents (الصادر):** create a goods-out document (header + lines). Posting it **removes** stock.
- **Current stock per item** = `SUM(incoming qty) − SUM(outgoing qty)`, derived from ledger entries — never stored as an authoritative editable field.
- **Stock movement view:** chronological ledger (incoming + outgoing) for a single item.
- **Offline-first, local persistence** (SQLite). Service layer swappable to a real backend later.

### Non-Goals (explicitly OUT of Step 1)
- ❌ Customers / Suppliers (Step 2).
- ❌ Expenses (نفقات).
- ❌ Multi-store / multiple warehouses (only one implicit "Main Store").
- ❌ Reports beyond a basic stock list + per-item movement (no P&L, debts, sales-by-X, cash book).
- ❌ Barcode camera scanning UI (barcode is a plain text field in Step 1; scanner deferred to Step 7).
- ❌ Payments, discounts, taxes, currency conversion (later steps).

> **Deferred vs dropped:** parties/debts/expenses/cash/reports above are **core to this full-ERP product**, just built in later steps (2–6) — not cut. What *is* permanently cut (whole product, not just Step 1): **auth, cloud sync, networking, multi-device, RBAC** — local single-user only ([roadmap non-goals](./roadmap.md#explicitly-out-of-scope-non-goals)). No `api/client`, no persist-to-server, ever.

---

## 2. Domain Glossary

| EN term | AR term | Definition (Step 1) |
|---|---|---|
| Item / Good | البضاعة / الصنف | A tracked product. Has name, unit, cost & sale price, optional barcode & image. |
| Unit | الوحدة | Measure of quantity (piece/قطعة, kg/كجم, box/صندوق...). Free-text or preset in Step 1. |
| Incoming Document | مستند وارد | A goods-in receipt. Increases stock. Header + lines. |
| Outgoing Document | مستند صادر | A goods-out issue/sale. Decreases stock. Header + lines. |
| Document Line | سطر المستند | One `(item, qty, unit_price)` row within a document. |
| Ledger Entry | حركة | The atomic stock effect derived from a **posted** document line: `+qty` (incoming) or `−qty` (outgoing). |
| Posting | ترحيل | Marking a document `posted` so its lines affect stock. Draft docs do NOT affect stock. |
| Stock / On-hand | الرصيد / المخزون | Derived quantity per item = Σ signed ledger entries. |
| Stock Movement | حركة المخزون | Chronological list of ledger entries for one item. |
| Main Store | المخزن الرئيسي | The single implicit warehouse. Not modeled as a table in Step 1. |

**Money & quantity conventions:** money is stored as an **`INTEGER` in minor units** (piastres/cents) — never `REAL`. This app grows into a full P&L/COGS ERP, and floating-point money drifts across a ledger; storing floats now is a correctness bug we'd have to migrate out of later. `12.50 EGP` → `1250`. Convert decimal→minor at the input boundary; all arithmetic is integer math; format for display only. Helpers in `src/utils/money.ts` (`toMinor`/`fromMinor`/`formatMoney`). Full rules in [`data-model.md` §6](./data-model.md#6-money-handling) — **canonical**. Quantities stay `REAL` (fractional units like kg). Single implicit currency in Step 1 (`currency` still stored per row, default `EGP`).

> **`data-model.md` is the canonical source** for storage conventions (minor-unit money, `INTEGER` epoch-ms timestamps, UUIDv7 ids, the four standard columns, and the `document_lines` + `stock_levels` model). Where the DDL sketch below simplifies for Step-1 readability, the data-model doc wins.

---

## 3. Data Model (Step 1 only)

Persistence: **`expo-sqlite`** (bundled with Expo SDK 54, no custom native module → no ADR needed, works in dev client), with **Drizzle ORM** for type-safe schema + `drizzle-kit` numbered migrations. Source of truth for the persistence stack + full ER model + migration strategy is [`data-model.md`](./data-model.md); this doc's DDL below is the Step-1 subset. Wrapped behind a repository in `services/` so it is swappable to a backend or op-sqlite later.

### 3.1 Entity overview

```
items 1 ──< document_lines >── N documents
                    │
                    └── (posted lines) ──> ledger_entries (materialized on post)
```

Two supported strategies for stock — **Step 1 uses the materialized `ledger_entries` table** (fast reads, simple movement view, clean edit/delete semantics). Lines remain the editable source; ledger entries are regenerated on post/unpost.

### 3.2 SQL DDL

```sql
-- ITEMS -----------------------------------------------------------------
CREATE TABLE items (
  id            TEXT PRIMARY KEY,                 -- uuid v4
  name          TEXT NOT NULL,
  barcode       TEXT,                             -- optional, unique when present
  unit          TEXT NOT NULL DEFAULT 'piece',    -- 'piece' | 'kg' | 'box' | free text
  cost_price    INTEGER NOT NULL DEFAULT 0,       -- purchase price, MINOR UNITS (piastres)
  sale_price    INTEGER NOT NULL DEFAULT 0,       -- selling price, MINOR UNITS
  currency      TEXT NOT NULL DEFAULT 'EGP',      -- ISO 4217
  image_uri     TEXT,                             -- optional local file uri
  is_archived   INTEGER NOT NULL DEFAULT 0,       -- soft delete (0/1)
  created_at    TEXT NOT NULL,                    -- ISO 8601
  updated_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_items_barcode ON items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_archived ON items(is_archived);

-- DOCUMENTS (header) ----------------------------------------------------
CREATE TABLE documents (
  id            TEXT PRIMARY KEY,                 -- uuid v4
  type          TEXT NOT NULL,                    -- 'incoming' | 'outgoing'
  number        TEXT NOT NULL,                    -- human ref, e.g. IN-000123 / OUT-000045
  doc_date      TEXT NOT NULL,                    -- ISO 8601 (date the doc represents)
  status        TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'posted'
  note          TEXT,
  total_amount  INTEGER NOT NULL DEFAULT 0,       -- cached Σ(line_total), MINOR UNITS
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  posted_at     TEXT
);
CREATE INDEX idx_documents_type_status ON documents(type, status);
CREATE INDEX idx_documents_date ON documents(doc_date);
CREATE UNIQUE INDEX idx_documents_number ON documents(type, number);

-- DOCUMENT LINES (editable source of truth) -----------------------------
CREATE TABLE document_lines (
  id            TEXT PRIMARY KEY,                 -- uuid v4
  document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL REFERENCES items(id),
  qty           REAL NOT NULL,                    -- > 0 (fractional ok, e.g. kg)
  unit_price    INTEGER NOT NULL DEFAULT 0,       -- unit cost (incoming) or price (outgoing), MINOR UNITS
  line_total    INTEGER NOT NULL DEFAULT 0,       -- round(qty * unit_price), MINOR UNITS, cached
  sort_index    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_lines_document ON document_lines(document_id);
CREATE INDEX idx_lines_item ON document_lines(item_id);

-- LEDGER ENTRIES (materialized on post; the stock source) ---------------
CREATE TABLE ledger_entries (
  id            TEXT PRIMARY KEY,                 -- uuid v4
  item_id       TEXT NOT NULL REFERENCES items(id),
  document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  line_id       TEXT NOT NULL REFERENCES document_lines(id) ON DELETE CASCADE,
  direction     INTEGER NOT NULL,                 -- +1 incoming, -1 outgoing
  qty           REAL NOT NULL,                    -- always positive magnitude
  signed_qty    REAL NOT NULL,                    -- direction * qty  (the stock delta)
  unit_price    INTEGER NOT NULL DEFAULT 0,       -- MINOR UNITS (unit cost captured at post → COGS later)
  entry_date    TEXT NOT NULL,                    -- copy of document.doc_date for ordering
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_ledger_item_date ON ledger_entries(item_id, entry_date);
CREATE INDEX idx_ledger_document ON ledger_entries(document_id);
```

### 3.3 Stock query (derived, never stored on item)

```sql
-- Current on-hand for one item
SELECT COALESCE(SUM(signed_qty), 0) AS on_hand
FROM ledger_entries WHERE item_id = ?;

-- Stock list (all items with on-hand), RTL list source
SELECT i.*, COALESCE(SUM(le.signed_qty), 0) AS on_hand
FROM items i
LEFT JOIN ledger_entries le ON le.item_id = i.id
WHERE i.is_archived = 0
GROUP BY i.id
ORDER BY i.name;

-- Per-item movement (chronological)
SELECT le.*, d.type, d.number
FROM ledger_entries le JOIN documents d ON d.id = le.document_id
WHERE le.item_id = ?
ORDER BY le.entry_date ASC, le.created_at ASC;
```

### 3.4 TypeScript types (`src/features/inventory/types.ts`)

```ts
export type DocumentType = 'incoming' | 'outgoing';
export type DocumentStatus = 'draft' | 'posted';
export type StockUnit = 'piece' | 'kg' | 'box' | (string & {}); // preset + free text

export interface Item {
  id: string;
  name: string;
  barcode?: string | null;
  unit: StockUnit;
  costPrice: number;   // minor units (piastres) — integer
  salePrice: number;   // minor units — integer
  currency: string;    // ISO 4217, default 'EGP'
  imageUri?: string | null;
  isArchived: boolean;
  createdAt: string; // ISO
  updatedAt: string;
}

/** Item enriched with derived stock, used by list/movement screens. */
export interface ItemWithStock extends Item {
  onHand: number;
}

export interface DocumentLine {
  id: string;
  documentId: string;
  itemId: string;
  qty: number;        // > 0
  unitPrice: number;  // cost for incoming, price for outgoing
  lineTotal: number;  // qty * unitPrice
  sortIndex: number;
}

export interface StockDocument {
  id: string;
  type: DocumentType;
  number: string;
  docDate: string;      // ISO
  status: DocumentStatus;
  note?: string | null;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  postedAt?: string | null;
}

/** Header + lines, used by the doc editor screens. */
export interface StockDocumentWithLines extends StockDocument {
  lines: DocumentLine[];
}

export interface LedgerEntry {
  id: string;
  itemId: string;
  documentId: string;
  lineId: string;
  direction: 1 | -1;
  qty: number;        // magnitude
  signedQty: number;  // direction * qty
  unitPrice: number;
  entryDate: string;
  createdAt: string;
}

/** Movement row joined with document ref, for the movement screen. */
export interface MovementRow extends LedgerEntry {
  docType: DocumentType;
  docNumber: string;
}

// Draft input shapes for forms/mutations
export type ItemInput = Omit<Item, 'id' | 'isArchived' | 'createdAt' | 'updatedAt'>;
export interface DocumentLineInput { itemId: string; qty: number; unitPrice: number; }
export interface DocumentInput {
  type: DocumentType;
  number?: string;      // auto-generated if omitted
  docDate: string;
  note?: string;
  lines: DocumentLineInput[];
}
```

---

## 4. Feature Folder Plan

All Step-1 code lives in **one feature**: `src/features/inventory/`. Follows AGENTS.md layering `screens → hooks → services → (sqlite) db`. No barrel files except the feature `index.ts`.

```
src/features/inventory/
  types.ts                         # all TS entity/input types (§3.4)
  index.ts                         # PUBLIC surface: screens + public types ONLY

  services/
    db.ts                          # opens expo-sqlite DB, runs migrations, exposes exec/tx helpers
    migrations.ts                  # ordered DDL (§3.2) + schema_version bookkeeping
    itemService.ts                 # CRUD items + on-hand queries (pure, no React)
    documentService.ts             # CRUD documents+lines, post/unpost, ledger materialization
    ledgerService.ts               # movement queries, stock aggregation, negative-stock check
    numbering.ts                   # next doc number per type (IN-/OUT- sequence)
    mappers.ts                     # row <-> domain object mapping (snake_case <-> camelCase)

  hooks/
    inventory-keys.ts              # TanStack queryKey factory (items, docs, movement, stock)
    useItemsQuery.ts               # list items (+on-hand) via itemService
    useItemQuery.ts                # single item by id
    useItemMutations.ts            # create/update/archive item (invalidations documented here)
    useDocumentsQuery.ts           # list documents (filter by type/status)
    useDocumentQuery.ts            # single document + lines
    useDocumentMutations.ts        # create/update/post/unpost/delete doc (optimistic on-hand)
    useItemMovementQuery.ts        # per-item ledger rows
    useDocumentForm.ts             # form state + validation for incoming/outgoing editor

  store/
    inventory-ui-store.ts          # zustand: client-only UI (list filter, sort, negativeStockPolicy flag)

  components/
    ItemListRow.tsx                # item name + on-hand + prices, tap → detail
    ItemForm.tsx                   # controlled inputs for item add/edit
    ImagePickerField.tsx           # optional image capture/pick (expo-image-picker)
    DocumentListRow.tsx            # doc number, type badge, date, total, status
    DocumentTypeBadge.tsx          # وارد / صادر colored badge
    DocumentLineEditor.tsx         # single editable line: item picker + qty + price
    LineItemPicker.tsx             # searchable item selector (barcode/name)
    MovementRow.tsx                # one ledger row: +/- qty, running balance, doc ref
    StockBadge.tsx                 # on-hand pill, red when <= 0
    QtyPriceInput.tsx              # numeric inputs w/ RTL + decimal handling

  screens/
    ItemsListScreen.tsx            # stock list (items + on-hand) — main tab
    ItemEditScreen.tsx             # add/edit one item
    ItemMovementScreen.tsx         # chronological movement for one item
    DocumentsListScreen.tsx        # all documents (incoming+outgoing), filterable
    IncomingDocScreen.tsx          # create/edit + post an incoming document
    OutgoingDocScreen.tsx          # create/edit + post an outgoing document
```

**Shared / non-feature touch points (per AGENTS.md):**
- `src/navigation/` — register the six screens + route param types & zod route schemas.
- `src/i18n/locales/ar.json` + `en.json` — all strings under `inventory.*` keys. `ar` is default locale; enable RTL via `I18nManager.forceRTL(true)` in `src/app/`.
- `src/components/ui/` — reuse `EmptyState`, `ErrorState`, `Skeleton`, `LoadingOverlay` (no `OfflineBanner` needed — fully local).
- `src/services/query/queryClient.ts` — existing client; add MMKV `persistQueryClient` so lists survive cold start.
- **No `services/api/client` usage** in Step 1. `db.ts` is the "api client equivalent"; only `services/**` touches SQLite (AGENTS.md storage rule).

---

## 5. Screen Inventory

### 5.1 ItemsListScreen (قائمة البضائع / الرصيد) — main entry
- **Purpose:** the stock list — every item with derived on-hand.
- **UI:** FlashList of `ItemListRow` (name, `StockBadge` on-hand, sale price, thumbnail); search bar (name/barcode); sort toggle (name / low-stock); FAB "إضافة صنف".
- **Actions:** tap row → ItemMovementScreen; tap FAB → ItemEditScreen (create); long-press → edit/archive.
- **Nav edges:** → ItemEditScreen, → ItemMovementScreen. Header link → DocumentsListScreen.
- **States:** `EmptyState` ("لا توجد أصناف"), `Skeleton list`, `ErrorState`.

### 5.2 ItemEditScreen (إضافة / تعديل صنف)
- **Purpose:** create or edit one item.
- **UI:** `ItemForm` — name (required), barcode (optional text), unit picker, cost price, sale price, `ImagePickerField`. Save / Cancel; Delete (edit mode) → archive.
- **Actions:** validate → `useItemMutations.create/update`; archive.
- **Nav edges:** ← back to ItemsListScreen on save.

### 5.3 ItemMovementScreen (حركة المخزون للصنف)
- **Purpose:** chronological ledger for one item + current on-hand header.
- **UI:** header (item name, on-hand `StockBadge`); FlashList of `MovementRow` (date, doc type badge, doc number, ±qty, running balance).
- **Actions:** tap a row → open its source document (Incoming/OutgoingDocScreen, read/edit).
- **Nav edges:** → IncomingDocScreen / OutgoingDocScreen.

### 5.4 DocumentsListScreen (المستندات)
- **Purpose:** list all incoming + outgoing documents.
- **UI:** segmented filter (الكل / وارد / صادر / مسودة); FlashList of `DocumentListRow` (number, `DocumentTypeBadge`, date, total, status); two FABs / speed-dial: "وارد جديد", "صادر جديد".
- **Actions:** tap → open editor; FAB → new doc.
- **Nav edges:** → IncomingDocScreen, → OutgoingDocScreen.

### 5.5 IncomingDocScreen (وارد جديد / تعديل)
- **Purpose:** build & post a goods-in document.
- **UI:** header (auto number `IN-xxxxxx`, date picker, note); lines list of `DocumentLineEditor` (item picker, qty, **unit cost** defaulting to item.costPrice); running total; "إضافة سطر"; buttons **Save draft** / **Post (ترحيل)**.
- **Actions:** add/edit/remove line; save draft; post → materialize `+qty` ledger entries; unpost (if posted) → remove ledger entries.
- **Nav edges:** ← DocumentsListScreen / ItemMovementScreen. Item picker may deep-link to ItemEditScreen to create a missing item.

### 5.6 OutgoingDocScreen (صادر جديد / تعديل)
- **Purpose:** build & post a goods-out document.
- **UI:** identical layout to 5.5 but line price is **unit sale price** defaulting to item.salePrice; per-line on-hand hint; warning/block when qty > on-hand per negative-stock policy.
- **Actions:** same as incoming but posts `−qty` ledger entries.
- **Nav edges:** same as 5.5.

**Navigation graph:**
```
ItemsListScreen ──► ItemEditScreen
        │           
        └─► ItemMovementScreen ──► Incoming/OutgoingDocScreen
Header ─► DocumentsListScreen ──► IncomingDocScreen
                              └─► OutgoingDocScreen
```

---

## 6. Core Flows

### Flow A — Add item
1. ItemsListScreen → tap FAB → ItemEditScreen (empty).
2. Enter name (required), optional barcode, unit, cost, sale price, optional image.
3. Validate (§7). Barcode uniqueness checked against `items`.
4. `itemService.create` inserts row (uuid, timestamps, `is_archived=0`).
5. Invalidate `inventory-keys.items()`. Return to list; new item shows `on_hand = 0`.

### Flow B — Create & post an INCOMING document (adds stock)
1. DocumentsListScreen → "وارد جديد" → IncomingDocScreen. Number auto = `numbering.next('incoming')`.
2. Set date/note. Add ≥1 line: pick item, qty (>0), unit cost (defaults to item.costPrice).
3. Optionally **Save draft** → `documentService.saveDraft` writes `documents(status='draft')` + `document_lines`. **No ledger effect.**
4. **Post** → `documentService.post(docId)` in one SQLite transaction:
   - set `status='posted'`, `posted_at=now`;
   - for each line insert `ledger_entries(direction=+1, qty, signed_qty=+qty, entry_date=doc_date)`;
   - recompute cached `total_amount` / `line_total`.
5. Invalidate `documents`, `items` (on-hand), and affected `movement(itemId)` keys.
6. Each item's on-hand increases by its posted qty.

### Flow C — Create & post an OUTGOING document (removes stock)
1. Same as B via "صادر جديد" → OutgoingDocScreen. Line price defaults to item.salePrice.
2. On qty entry, show per-line on-hand; enforce negative-stock policy (§7).
3. Post → same transaction but `direction=−1, signed_qty=−qty`.
4. Invalidations identical to B. On-hand decreases.

### Flow D — View current stock
1. ItemsListScreen mounts → `useItemsQuery` → `itemService.listWithStock()` runs the GROUP-BY join (§3.3).
2. Each row shows on-hand; `StockBadge` turns red when `on_hand <= 0`.
3. Pull-to-refresh re-runs the query (also auto-invalidated by any post/unpost).

### Flow E — View item movement
1. Tap item → ItemMovementScreen → `useItemMovementQuery(itemId)` → `ledgerService.movement(itemId)`.
2. Rows ordered by `entry_date ASC, created_at ASC`; running balance computed client-side cumulatively.
3. Header on-hand = last running balance = `SUM(signed_qty)`.

### Stock recompute rule
> **On-hand is always derived, never stored on `items`.**
> `on_hand(item) = Σ ledger_entries.signed_qty WHERE item_id = item AND (its document is posted)`.
> Because ledger entries exist **only** for posted documents, the join is enough — no status filter needed on reads.

### Edit / delete of a POSTED document
- **Edit a posted document:** the editor first **unposts** (deletes its `ledger_entries`, sets `status='draft'`), applies line edits, then **re-posts** (re-materializes ledger). Done in a single transaction so stock never observes a partial state. On outgoing edits the negative-stock policy is re-checked against the recomputed on-hand.
- **Delete a posted document:** confirm → transaction deletes `documents` row; `ON DELETE CASCADE` removes `document_lines` and `ledger_entries` → on-hand automatically corrects. Invalidate `documents`, `items`, and each affected `movement(itemId)`.
- **Delete a draft:** just removes header + lines (no ledger existed). No stock impact.
- **Deleting an item** that has ledger entries: **blocked** — offer archive (`is_archived=1`) instead; archived items hidden from lists but keep history.

---

## 7. Business Rules & Validations

| Rule | Spec |
|---|---|
| Item name | Required, trimmed, non-empty, ≤ 120 chars. |
| Barcode | Optional; if present must be unique among non-archived items. |
| Unit | Required; preset or free text; default `piece` (قطعة). |
| Prices | `cost_price`, `sale_price` ≥ 0. Stored `INTEGER` **minor units**; UI decimal parsed via `toMinor()` at input, `fromMinor()`/`formatMoney()` for display (`Intl.NumberFormat`, ar locale). |
| Line qty | **Must be > 0.** Reject 0 / negative / non-numeric. Fractional allowed (units like kg). |
| Line unit price | ≥ 0. Defaults from item (cost for incoming, sale for outgoing) but editable. |
| Document lines | A document must have ≥ 1 line to be **posted** (draft may have 0). |
| Duplicate item in lines | Allowed (merged only for display totals); each line is its own ledger entry. |
| Negative stock policy | **Configurable flag** `allowNegativeStock` in `inventory-ui-store` (persisted). Default **`false`**. When `false`, posting an outgoing line whose qty would drive on-hand below 0 is **blocked** with a validation error naming the item + available qty. When `true`, allowed and on-hand may go negative (shown red). |
| Money rounding | All money is integer minor units. `qty` may be fractional, so the single rounding point is `line_total = round(qty * unit_price)` (round-half-up to the minor unit) at write; `total_amount = Σ line_total`. No float money anywhere. See [`data-model.md` §6](./data-model.md#6-money-handling). |
| Doc number | Auto `IN-000001` / `OUT-000001`, zero-padded 6, per-type monotonic via `numbering.ts`. Unique per `(type, number)`. Editable but must stay unique. |
| Doc date | Required; defaults to today; ISO 8601; drives ledger ordering. |
| Timestamps | `created_at`/`updated_at` server-agnostic ISO strings set in service layer. |
| Concurrency | Single local user; all post/unpost/delete wrapped in one SQLite transaction. |

---

## 8. Acceptance Criteria (testable)

- [ ] Creating an item persists it; it appears in ItemsListScreen with on-hand 0.
- [ ] Editing an item updates its fields and `updated_at`; list reflects change.
- [ ] Barcode uniqueness is enforced (duplicate barcode rejected with error).
- [ ] Item with ledger history cannot be hard-deleted; archive hides it from lists but keeps movement.
- [ ] Posting an incoming doc with line `(A, 10)` makes A's on-hand = 10.
- [ ] Posting an outgoing doc with line `(A, 3)` afterward makes A's on-hand = 7.
- [ ] On-hand for an item equals `Σ signed ledger qty` across all its posted docs (property test).
- [ ] Draft documents do **not** affect on-hand; posting a draft applies its effect exactly once.
- [ ] With `allowNegativeStock=false`, posting an outgoing line exceeding on-hand is blocked with a clear Arabic error.
- [ ] With `allowNegativeStock=true`, the same post succeeds and on-hand shows negative (red).
- [ ] Editing a posted doc's qty updates on-hand correctly (no double counting) via unpost→edit→repost.
- [ ] Deleting a posted doc removes its stock effect (cascade) and its movement rows.
- [ ] ItemMovementScreen lists entries chronologically with a correct cumulative running balance; final balance == header on-hand.
- [ ] App works fully offline (airplane mode) with no network calls; data survives app restart (SQLite persisted).
- [ ] UI renders RTL; all strings come from `inventory.*` i18n keys (no hard-coded JSX literals).
- [ ] `documentService.post` / `unpost` are unit-tested (happy path + negative-stock block) with an in-memory/temp SQLite DB.

---

## 9. Task Backlog (M0 → done, ordered)

> **Autonomous build log** — layout note: repo uses `src/db/` + `src/repositories/`
> (AGENTS.md-canonical) instead of the older `features/inventory/services/` sketch
> below; data-model.md wins. Schema follows data-model.md (lines-as-ledger, direction
> on the document header) not the separate `ledger_entries` table.
> Also added (prereq, not in original backlog): jest (ts-jest) + eslint flat config
> enforcing AGENTS.md hard rules — the quality gates. Commit `5992384`.

**M0 — Scaffolding**
- [x] Add `expo-sqlite`, `expo-image-picker`, `uuid`/`expo-crypto` deps (justify in PR). *(all present; image-picker added `5992384`)*
- [~] Create `src/features/inventory/` skeleton (folders + `types.ts` from §3.4 + `index.ts`). *(folders/types/components/hooks exist; feature `index.ts` public surface still TODO)*
- [~] `services/db.ts`: open DB, transaction helper; `migrations.ts` with §3.2 DDL + `schema_version`. *(src/db/client+migrate+schema exist; missing: draft/posted `status`, doc numbering, `schema_version` bookkeeping, tx helper — M2 slice)*
- [x] Ensure RTL: `I18nManager.forceRTL(true)` + `ar` default in `src/app/`; add `inventory.*` keys to `ar.json`/`en.json`. *(i18n + theme/rtl.ts in place)*

**M1 — Items**
- [ ] `mappers.ts` + `itemService.ts` (create/update/archive/getById/listWithStock) + tests.
- [ ] `inventory-keys.ts`, `useItemsQuery`, `useItemQuery`, `useItemMutations`.
- [ ] `ItemForm`, `ImagePickerField`, `ItemListRow`, `StockBadge`.
- [ ] `ItemsListScreen`, `ItemEditScreen`; register routes.

**M2 — Documents & posting**
- [ ] `numbering.ts` (per-type sequence) + tests.
- [ ] `documentService.ts` (saveDraft/get/list/update/post/unpost/delete, transactional ledger materialization) + tests (happy + negative-stock block).
- [ ] `ledgerService.ts` (movement query, on-hand aggregate, negative-stock check).
- [ ] `useDocumentsQuery`, `useDocumentQuery`, `useDocumentMutations`, `useDocumentForm`.
- [ ] `DocumentListRow`, `DocumentTypeBadge`, `DocumentLineEditor`, `LineItemPicker`, `QtyPriceInput`.
- [ ] `DocumentsListScreen`, `IncomingDocScreen`, `OutgoingDocScreen`; register routes + zod route schemas.

**M3 — Movement & stock**
- [ ] `useItemMovementQuery`; `MovementRow` with running balance.
- [ ] `ItemMovementScreen` (header on-hand + list); wire tap-through to source docs.
- [ ] `inventory-ui-store` (filter/sort + persisted `allowNegativeStock`); settings toggle surfaced in list header.

**M4 — Polish & verify**
- [ ] Loading/Empty/Error states on every screen (UI primitives).
- [ ] Persist TanStack cache (MMKV) for cold-start.
- [ ] Maestro e2e: add item → post incoming → post outgoing → verify on-hand & movement.
- [ ] Lint/tsc/prettier clean; NativeWind-only styling; a11y labels on touchables.

---

## 10. What Step 2 Unlocks

Step 2 introduces **Customers (العملاء)** and **Suppliers (الموردون)** as parties on outgoing/incoming docs, enabling **debts by customer/supplier** (accounts receivable/payable). The document header gains an optional `party_id`; ledgers stay unchanged, and a new balances view aggregates unpaid document totals per party.
