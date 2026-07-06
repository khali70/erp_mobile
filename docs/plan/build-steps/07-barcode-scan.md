# Step 7 — Barcode & Scan UX

> **Goal:** camera-first barcode scanning that accelerates entry without ever gating it — resolve a code to an item, scan-to-add document lines, and rapid scan for counts. Plus plug-and-play support for a hardware (BT/USB HID) scanner.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `DirectoryModals: ScannerModal` | `services/scanner/` + `features/scan/components/ScanSheet` | camera scan; resolve against local catalog |
| scan-to-line in `NewSaleScreen` / `NewPurchaseScreen` | wired into Step 3 add-line flow | scan → prefilled line |
| barcode field on `AddItem` | Step 1 `ItemFormSheet` gains real scan | code capture + uniqueness |

## Entities / schema

- `barcode` is an **attribute on `items`** (already reserved as a placeholder in Step 1) — uniqueness lookup, not a new table.

## Key flows (port intent)

- **Scan resolves against the local catalog** — must work fully offline. Three outcomes:
  - (a) found → open/select item
  - (b) not found → start new item with code pre-filled
  - (c) drive stock-in/out and sale/purchase lines
- Rapid scan mode for inventory counts (Step 4).
- Only `services/scanner/` opens the camera-for-scanning; feature code calls `useScanner()`.

## Guard-rails (never port from mock)

- The mock `ScannerModal` just picks from a static list — build a **real** `expo-camera` / vision-camera code scanner resolving against SQLite.
- **Scanning accelerates, never gates.** Not every good has a barcode (loose/bulk) — search + manual entry always available.
- **HID-ready:** every barcode field also accepts typed/HID keyboard input, so a €20 Bluetooth scanner (which types into the focused field) works with **zero native driver work**. Camera button **+** HID-input on every scan field. Buy hardware only if intake volume proves the camera too slow.

## Dashboard wiring

- Barcode quick-action tile (باركود) opens the scanner and routes the result by context (find in items vs add to active document).

## Done when

Scanning a code resolves to the right item (or offers create) and can drive document-line and count entry hands-free, fully offline, with HID input accepted on the same fields. Correct after restart.
