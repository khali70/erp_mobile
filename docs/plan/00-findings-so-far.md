# ERP Mobile — Findings So Far

> Working notes: what is known about the app being cloned, evidence level, decisions taken, and open questions. Tags: **Observed** (seen on device), **Inferred** (deduced), **Assumed** (not yet verified).

Last updated: 2026-07-06

---

## 1. Target app fingerprint

| Field | Value | Evidence |
|---|---|---|
| Package | `com.stockmanagment.next.app` | Observed (`dumpsys window` focus) |
| Launch activity | `com.stockmanagment.app.ui.activities.MenuActivity` | Observed |
| App title (AR) | الجرد والمخزون ببساطة ("Inventory & Stock, Simply") | Observed |
| Style | StockManagement-family inventory ERP | Inferred |
| Language / dir | Arabic, **RTL** | Observed |
| Multi-store | Yes — header shows "Main Store" | Observed |
| Framework | Not yet fingerprinted (APK not pulled) | Assumed native/other — **TODO** |
| Backend/API | Unknown — not captured | **TODO** |

Device: `192.168.1.21:5555` (adb over wifi). `scrcpy` also available (preferred for live nav — adb BACK key exited the app during walk).

---

## 2. Main menu — observed tiles

Grid of tiles on `MenuActivity`:

| Tile (AR) | Meaning | Badge |
|---|---|---|
| المستندات | Documents | 3 |
| البضائع | Goods / Items | 1 |
| نفقات | Expenses | — |
| التقارير | Reports | — |
| جديد الصادر | New Outgoing (goods-out) | — |
| جديد الوارد | New Incoming (goods-in) | — |
| بحاجة إلى مساعدة؟ | Help | — |
| مسح الباركود | Barcode scan | — |
| (footer icons) | Help ⃝, Settings ⚙, Customers 👤$, Suppliers 👤📦 | — |

Badges (3 docs, 1 item) = live counts from local data.

---

## 3. Reports module — observed list

From التقارير screen (all starred/favoritable, each has ⋮ menu):

- الارباح والخسائر — **Profit & Loss**
- الديون حسب الزبون — **Debts by customer** (AR / receivables)
- الديون حسب المورد — **Debts by supplier** (AP / payables)
- الشراء حسب العناصر — Purchases by item
- الشراء حسب المورد — Purchases by supplier
- المبيعات حسب الاصناف — Sales by item/category
- المبيعات حسب التاريخ — Sales by date
- المبيعات حسب الزبون — Sales by customer
- المبيعات حسب الشهر — Sales by month
- حركة المخزون — **Stock movement**
- دفتر النقدية — **Cash book**
- قائمة المستندات — Documents list
- قائمة المعاملات — Transactions list
- (report reorder option at top: إعادة ترتيب التقرير)

**Read:** this is real double-entry-style thinking — perpetual inventory + AR/AP + cash book + P&L. Not a toy.

---

## 4. Not yet walked (gaps)

Screens/flows NOT yet directly observed (adb BACK exited app; will use scrcpy next):

- [ ] Goods/Items list + item detail/edit form (fields unconfirmed)
- [ ] New Incoming document form (header + line fields)
- [ ] New Outgoing document form (header + line fields)
- [ ] Documents list detail
- [ ] Expenses screen
- [ ] Customers / Suppliers screens (party fields, debt display)
- [ ] Barcode scan flow
- [ ] Settings (stores, currency, valuation method, permissions)
- [ ] Any auth/login (none seen — **Assumed** local-only, no account)

---

## 5. ERP module coverage (present / absent)

| Module | Status | Note |
|---|---|---|
| Inventory / stock | Present | core |
| Items / catalog | Present | with barcode |
| Documents (in/out) | Present | ledger spine |
| Transfer / stock-count | Inferred | multi-store implies transfer; count likely |
| Customers / CRM | Present | party + debts |
| Suppliers / vendors | Present | party + debts |
| Accounting / cash book | Present | dفتر النقدية |
| Reports / analytics | Present | rich set (§3) |
| Barcode / QR | Present | scan tile |
| Expenses | Present | نفقات tile |
| Multi-store | Present | "Main Store" header |
| Auth / roles | Absent/unknown | no login seen |
| Offline / sync | Inferred | local badges → offline-first; sync unknown |
| Multi-currency | Absent/unknown | not observed |
| Notifications | Unknown | — |

---

## 6. Finance / business-owner take

**Strengths of the target app**
- Perpetual inventory via document ledger = correct model. Stock is a *consequence* of posted docs, not a hand-edited number.
- AR (debts by customer) + AP (debts by supplier) + cash book + P&L = genuine accounting backbone.
- Report set maps cleanly to what a small-shop owner actually asks: what sold, who owes me, what I owe, what's on the shelf, what's my profit.

**Risks / gaps to pin down**
- **Valuation method** (FIFO / weighted-average / last-cost) not visible → drives COGS + true profit. Must decide.
- Debts have no **aging buckets** observed → cash-flow blind spot for the owner.
- No multi-currency → fine for single-market, risk if cross-border.
- No auth/roles seen → single-device trust model; multi-user needs it later.

**Decision locked for our build**
- **Valuation = weighted-average** for the rebuild (simplest correct, no lot tracking). Recompute COGS from incoming-line unit costs. Revisit if owner needs FIFO.
- Store **unit cost on every incoming line** from Step 1 (cheap now, enables COGS later with no migration).
- `allowNegativeStock` = configurable flag (retail blocks, wholesale/backorder allows).

---

## 7. Rebuild — plan status

**Product identity (LOCKED by owner):** local, single-user, **full ERP** — stock + customers/suppliers with debts (AR/AP) + cash book + **P&L** are all core. **No cloud, no auth, no multi-device sync, no roles** — permanently out of scope. Data safety = local backup/restore, not cloud. See [`roadmap.md`](./roadmap.md#product-identity-locked). This retires the old "Step 8 Sync / Step 9 Roles" plan (roadmap now ends at Step 8 = Settings/Backup/Polish).

Target stack (per `AGENTS.md`): **React Native + Expo**, feature-isolated, offline-first, NativeWind, zustand (UI state) + TanStack Query (cache over local repos, **not** store of record), **SQLite + Drizzle = single source of truth**, RTL day one.

Planning docs written (this folder):

| Doc | Scope |
|---|---|
| `step-1-simple-store.md` | Step 1 spec: items + income ledger + export ledger, 6 screens, 5 flows, M0→M4 backlog |
| `roadmap.md` | 9-phase roadmap Step 1→feature-complete, dependency diagram, cross-cutting |
| `data-model.md` | Drizzle ORM on expo-sqlite, full ER, Step-1 DDL, forward-only migrations, sync-ready columns |

**Step 1 scope (owner-defined):** simplest working store =
1. Inventory items (name, barcode, unit, cost/sale price, image, derived stock)
2. Income ledger — incoming document, +qty to stock
3. Export ledger — outgoing document, −qty from stock
4. Current stock = Σ(incoming) − Σ(outgoing); stock-movement view
No customers/suppliers/expenses/multi-store/reports beyond stock list + per-item movement.

**Locked technical decisions**
- SQLite (expo-sqlite) + Drizzle ORM, repository behind `src/services/`
- Double-sided ledger: positive qty + direction (+1/−1); on-hand computed (view) for Step 1, migration path to cached `stock_levels`
- Money = integer minor units + currency field
- IDs = UUIDv7/ULID; four standard columns on every table: `id`, `created_at`/`updated_at` (epoch-ms), `deleted_at` soft-delete (archive-never-delete). **No sync columns** — local single-user (sync-forward path documented but not built, `data-model.md` §7).
- RTL/Arabic i18n from day one

---

## 8. Open questions for the owner

**Answered / closed:**
- ✅ **Q3 Single device forever?** → **Yes.** Local single-user, no sync, no accounts, no multi-device — permanent. (Kills Q5 too: no backend to reuse — there is no backend.)
- ✅ **Q5 Reuse target's backend?** → **N/A.** No backend at all; fully local.

**Still open:**
1. Valuation method — accept **weighted-average** (current locked default), or need FIFO/lot tracking?
2. Negative stock — block (retail) or allow (backorder)? (currently a configurable flag, default block)
4. One currency only, or multi-currency later? (`currency` stored per row regardless; day-1 UI single-currency)
6. Backup destination — local file / share sheet only, or also optional user-chosen Google Drive/iCloud file (still user-driven, not sync)?

---

## 9. Next actions

- [ ] Drive real app with **scrcpy** to fill §4 gaps (item form, doc forms, expenses, party screens) — screenshot + UI-dump each. This is now the **only** reverse-eng need: we're cloning observable UX/data fields, not a backend.
- [ ] (Optional) Phase 0 recon: pull APK, fingerprint framework, list permissions — informative only; our stack is already locked (RN+Expo+SQLite).
- [ ] ~~Phase 2 network/API capture~~ — **dropped.** Local single-user product, no backend to reverse.
- [ ] Then: scaffold Step 1 from `step-1-simple-store.md`.
