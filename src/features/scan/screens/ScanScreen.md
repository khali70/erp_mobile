# مسح الباركود — Barcode Scan Screen

> Part of **Rafuf**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 7.

## Purpose
Camera barcode/QR scanner. Resolves a code against the local catalog to (a) find an existing item, (b) start a new item with the code pre-filled, or (c) add a line to a sale/purchase document.

## UX
- Live camera with a scan reticle; torch toggle for low light.
- On decode: haptic + resolve. Known code → item; unknown → offer "add new item".
- Also accepts **HID scanner input** (Bluetooth/USB scanner types into a focused field) — no camera needed for high-volume intake.

## Navigation
- **In**: Home quick action «باركود»; barcode buttons inside NewOutgoing / NewIncoming / Items.
- **Out**: returns the resolved item to the caller; opens item-create.

## Why needed
Speed of entry — the #1 hill. Scanning accelerates every stock and sale flow. HID-ready future-proofs a €20 scanner with zero rework.

## Guard-rails
Scanning **accelerates, never gates** — search + manual entry always available (loose goods have no barcode). Fully offline against the local catalog.
