# Step 8 — Settings, Backup & Polish

> **Goal:** production-grade finish. Settings hub, full i18n, and the product's whole data-safety story — **local backup/restore + CSV export**. No cloud. This is the trust anchor for a local-only app: a lost or broken phone must not mean a lost business.

## Screens delivered

| Web component | Port to | Notes |
|---|---|---|
| `MoreScreen.tsx` (المزيد) | `features/settings/screens/SettingsScreen` | settings hub, backup/restore, export, reset |
| `MoreScreen` reset action | `features/settings/components/ResetDataSheet` | data reset **with backup-first guard** |

## Entities / schema (see `data-model.md`)

- `app_settings` — currency, number/date format, default store, theme, `allowNegativeStock`, valuation-method display, app-lock on/off. Single-row / key-value.
- `backup_manifest` — snapshot metadata (timestamp, entity counts, schema version) for restore validation.

## Key flows

- **Full local backup/restore:** one-tap JSON (or SQLite file) snapshot of the **entire DB, all entities** → shareable file / device storage via `expo-sharing`. Restore via `expo-document-picker` replaces local state and must reproduce state **exactly**. Show a visible **"last backed up"** status on the Dashboard.
- **Per-entity CSV export/import** (items, parties, documents) — feeds the owner's accountant; anti-lock-in escape hatch.
- **Settings** drive currency/format/negative-stock app-wide.
- **i18n polish:** complete Arabic + English catalogs (`src/i18n/locales/{ar,en}.json`), RTL edge-case fixes, in-app language switch (device currently resolves to English — default this app to Arabic).
- **Optional app-lock** (PIN/biometric via `expo-local-authentication`, secret in SecureStore) — the *only* gate, off by default. Not identity/auth.

## Guard-rails

- **Never a destructive action without a backup + undo path.** Reset is gated behind a backup-first prompt. Archive (soft-delete), don't hard-delete — the #1 lesson from the target app's data-loss reviews.
- Backup must round-trip: export → wipe → restore → byte-for-byte equal state. Test this explicitly.
- **No cloud / no auth / no sync** — backup is a user-driven file (optionally hand-saved to Drive/iCloud by the user, not synced). Stays out permanently (roadmap non-goals).

## Dashboard wiring

- "last backed up" status surfaced on Home so the owner is nudged to back up.

## Done when

A full backup exports and restores to reproduce state exactly, CSV export/import works offline, language/RTL switches cleanly, settings drive currency/format/negative-stock app-wide, and reset is backup-guarded. Correct after restart.
