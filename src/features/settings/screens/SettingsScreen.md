# الإعدادات — Settings, Backup & Restore Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 8.

## Purpose
App configuration + the **trust anchor**: local backup/restore. For a local-only app, a lost phone must not mean a lost business.

## UX
- **Preferences**: currency (EGP default), valuation method (weighted-average), allow-negative-stock flag, language (Arabic/English), app-lock (PIN/biometric, off by default).
- **Backup**: "last backed up" status, manual export (share sheet), optional user-chosen destination (Drive/iCloud file — user-driven, not sync).
- **Restore**: pick a backup file → fully rehydrate onto a fresh phone.
- **Export**: CSV/Excel of stock, low-stock, valuation for the accountant.

## Navigation
- **In**: Home header settings icon.
- **Out**: back to Home; opens system share / document picker.

## Why needed
Data-loss on update is the target app's #1 complaint. Backup/restore is existential and non-negotiable — it's why the owner can trust the app with their inventory.

## Guard-rails
Never a destructive action without a backup + undo path. Archive, don't hard-delete. Secrets (PIN hash) → SecureStore, never plain storage.
