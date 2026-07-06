# Stock & Inventory App — Analysis & Rebuild Brief
---

## 1. Target App Identity

| Field | Value |
|---|---|
| Name | **Stock and Inventory Simple** |
| Package | `com.stockmanagment.next.app` |
| Developer | Chester Software (Xaltos Technologies Ltd) |
| Installs | ~2.8M (~940/day) |
| Rating | 4.69★ / ~21k ratings |
| Version | 2.1.49 · Android 6.0+ · ~26.6 MB |
| Price | Free, no ads |
| Tech | **Native Android** (+iOS TestFlight). Firebase Analytics, Crashlytics, Google Drive backup, Play billing |

Two-app family: `next` = **Simple** (single-user, local). `online` = **Online** (multi-user, server sync, PRO subscription for 3+ users). Paid axis = collaboration + live cloud sync, NOT core features.

### Confirmed feature set
- **Items**: manual entry + Excel import, photos (camera/gallery), min-stock alerts, live quantity, custom fields, units-of-measure dictionary
- **Categories**: hierarchical folders, unlimited nesting
- **Stores/locations**: multiple, transfer between
- **Documents (4 types)**: Incoming (buy), Outgoing (sell), Stock-taking (count→replace), Transfer
- **Barcode/QR**: camera or external scanner → add to documents
- **Contacts**: customers + suppliers, import from phone
- **Finance**: customer/supplier payments, expense tracking (rent, salaries, fuel…)
- **Reports**: various, Excel export
- **Import/export**: Excel with column mapping
- **Print**: PDF price lists, catalogs, invoices, labels
- **Backup**: Google Drive (optional)
- **Offline**: local storage, works offline

### User complaints (design around these)
- **Data-loss on update** — inventory wiped. Community stresses frequent backups. ← biggest risk
- **No undo** on quantity mistakes — forces corrective documents
- No item tags
- **Rigid reports** — no custom/field-selectable, can't ask "what am I out of"
- Expenses bug (added entry not showing)
- Multi-user upgrade fees

---

## 2. Expert Core-Feature Plan (single solo shop owner)

**Thesis:** fast, offline, trustworthy catalog + proactive low-stock brain + money reports. Refuse every people-coordination feature. Two hills: **speed of entry** + **never lose data**.

### MVP (ranked)
1. **Product catalog** — fast add/edit/**duplicate** (clone size variants). Foundation.
2. **Stock levels + quick +/− in/out** — immutable movement log → every count explainable ("why is this 12?" → tap history)
3. **Low-stock alerts** — the #1 download reason. Stockout = double loss (sale + customer)
4. **Barcode scanning** — accelerate, never require (loose produce has no barcode)
5. **Search** — forgiving, incremental, typo-tolerant
6. **Categories** — flat single-level enough (target app's deep nesting = over-engineering for solo)
7. **Purchase & sales recording** — 2 events that move stock + carry money (cost in / price out)
8. **Reports** — stock value, movement, best/worst sellers, **dead stock** (trapped cash)
9. **Photos** — recognition over recall
10. **Units + pack↔unit conversion** (buy case of 24, sell singles)
11. **Backup/export** — existential. Lost phone = business gone. Non-negotiable
12. **Offline-first** — architecture day one, not bolt-on

### Tier-2
Suppliers/customers lite · receipts/invoices PDF · cost/margin (pull forward — cheap) · expiry/batch (grocery/pharmacy killer) · multi-location (keep `location_id` in schema, defer UI)

### OUT (non-goals)
Multi-user/roles · approvals · double-entry accounting · ERP/Shopify integrations · AI forecasting · label printing.
**Rule:** coordinates people or satisfies a regulator → out. Saves owner time/money → in.

### Design principles
- Core loop ≤3 taps / ~5s: find → change qty → confirm
- Thumb-zone actions (one-handed), big floating +/scan
- **Auto-save** every change (no save button). **Archive never delete.** Undo destructive
- Plain language — never "COGS"/"SKU velocity"
- Home answers 3 questions without navigating: what's low, stock value, what's selling

---

## 3. Data Model (movement-log-centric — never mutate qty, derive from log)

- **Product**: id, name, barcode?, sku?, category_id?, unit, pack_size?, cost_price, sale_price, reorder_threshold, reorder_qty, photo_uri, is_active, timestamps
- **StockLevel**: product_id, location_id, quantity_on_hand (cached, derived)
- **StockMovement** (immutable ledger — heart of trust): id, product_id, location_id, type (purchase_in/sale_out/adjustment/return/waste/transfer), quantity_delta, unit_cost|unit_price, reference_id, reason, batch_id?, created_at, device_id
- **Sale** + **SaleLine** · **Purchase** + **PurchaseLine**
- **Category**: id, name, sort_order
- Tier-2: **Supplier**, **Customer** (balance_owed for tabs), **Batch** (expiry)
- Every row: `updated_at` + `device_id` + dirty/synced flag → offline sync, last-write-wins

---


## 4. Recommended Stack & Build Order

**Stack:** React Native + Expo · **op-sqlite or expo-sqlite (+ Drizzle)** as source of truth · TanStack Query only if/when a sync backend exists (NOT as local data layer) · vision-camera code scanner · NativeWind · zustand for UI state · Google Drive / file backup.

**Build order** (each phase independently shippable):
- **P0 — Foundation**: local-first data layer + immutable movement log + auto backup. Architectural, can't retrofit.
- **P1 — Core loop** (usable product): catalog (fast add/dup) → stock +/− → search → categories → manual backup/export. Replaces the notebook.
- **P2 — The hook** (daily reliance): low-stock alerts + reorder list → barcode scan → photos.
- **P3 — The money** (justifies keeping it): sales/purchase w/ cost+price → units + pack conversion → reports (value, movement, best/worst, dead stock, margin).
- **P4 — Extras** (segment depth): suppliers/customers lite → invoices/receipts → expiry/batch → multi-location.

**Beat the target app on:** data-loss safety (auto-backup + undo + archive-never-delete), undo on mistakes, flexible reports ("what am I out of"). These are its top complaints.
