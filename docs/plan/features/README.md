# Feature Briefs — Brainstorm Round 1

Four features requested, four briefs written. Each contains: an opinion, how to apply it, and whether it's worth it.

Produced with the BMAD Method (`bmad-brainstorming`, "Ideate for me" stance), grounded in a full read of the current codebase rather than assumptions. Every file:line reference in these briefs was verified against the working tree, not recalled.

| # | Brief | Verdict | Cost |
|---|---|---|---|
| 1 | [Dashboard Privacy Mode](01-dashboard-privacy-mode.md) | ✅ Build | ~1 day |
| 2 | [Negotiated Selling Price](02-negotiated-selling-price.md) | ✅ **Build first** | ~1h + ~1 day |
| 3 | [Remote DB / Sync & Backup](03-remote-db-sync-and-backup.md) | ⚠️ **Split** — build backup, not sync | 1d / 4d / ~~8 weeks~~ |
| 4 | [Contacts in Party Picker](04-contacts-in-party-picker.md) | 🟡 Yes, but fix Arabic search first | ~2h + ~1 day |

---

## The four things worth knowing before you read anything else

**1. Feature 2 is already built. It's one inverted boolean away from working.**
`DocLineRow.tsx:35` reads `const isSale = mode === 'purchase'`. Because of that line, the price field is editable on *purchases* and read-only on *sales* — the exact opposite of what's wanted. `setPrice` is wired end to end (`useDocumentForm.ts:198` → `DocLinesSection.tsx:98` → `NewOutgoingScreen.tsx:68`) and is simply unreachable from the UI. The i18n labels are swapped to match. Fix the boolean and you can record negotiated prices today.

Until then, **every sale is recorded at list price**, so monthly profit is overstated by exactly the sum of every discount ever given. This isn't a missing feature; it's wrong data in the number the app exists to produce.

**2. There is no restore. Not "a bad restore" — none at all.**
`backup.ts` copies two `.db` files to the cache dir and opens the share sheet. Nothing in the codebase ever reads a backup back. Recovery today requires a computer and manual file surgery on the app's private storage, which will never happen for a real shopkeeper. *"Never lose data"* is one of the two stated hills to die on in `docs/PROJECT.md`, and it currently is not true. The backups are also unencrypted SQLite containing every customer's name, phone, and debt — headed for WhatsApp via the share sheet.

**3. Party search cannot match `احمد` to `أحمد`.**
`PartyPicker.tsx:35` is a raw `.includes()` — case-sensitive, no Arabic normalization. Alef hamza, taa marbuta, alef maqsura, Arabic-Indic digits, and trailing spaces all miss. When the search misses, the UI helpfully offers **"create new customer"** — so the merchant creates a duplicate, and the debt balance silently splits across two rows. A UX bug that is quietly corrupting the ledger. `LineItemPicker.tsx:28` has the same bug. **Two hours to fix, no dependency, no permission. Best-value work in the backlog.**

**4. You asked for a remote database. You need a restore button and an encrypted file in Google Drive.**
Sync solves *multi-device concurrent editing*. You have one shopkeeper and one phone (`docs/PROJECT.md` puts multi-device out of scope, permanently). Your actual problem — "the phone was stolen or broke" — is disaster recovery, and Tiers 0+1 in brief 3 solve it completely in under a week with zero backend, zero auth, and zero liability for holding other people's customer lists. Real sync is 4–8 weeks and makes every future feature slower, forever.

---

## Recommended order

| Order | Work | Why |
|---|---|---|
| **1** | Arabic normalizer (brief 4, phase 1) | 2h. Stops duplicate-party creation corrupting debt balances. Fixes item search for free. |
| **2** | Invert the `isSale` gate + fix labels (brief 2, §1) | 1h. Makes recorded revenue true. |
| **3** | Backup restore + auto-backup + encryption (brief 3, Tier 0) | 1d. Closes the hole under "never lose data". |
| **4** | Margin strip, price floor, `pricing_mode` (brief 2, §2) | 1d. Turns negotiated pricing from working into good. |
| **5** | Privacy Mode (brief 1) | 1d. Best cost-to-felt-value ratio. Presentation layer only, zero risk. |
| **6** | App Lock (brief 1, §7) | 1d. `expo-local-authentication` + `expo-secure-store` are already installed and **completely unused**. |
| **7** | Encrypted backup → Google Drive (brief 3, Tier 1) | 3–4d. Fully answers "stolen or broken". |
| **8** | Contacts import (brief 4, phase 2) | 1d. Polish. Lazy, opt-in, degradable. |
| **—** | ~~Remote DB / sync~~ (brief 3, Tier 2) | **Don't.** Revisit only if the product becomes multi-device. |

Steps 1–3 total about **half a day of coding** and fix two data-integrity bugs plus a missing recovery path. Do them before building anything new.

---

## Other things found along the way (not requested — flagged, not scoped)

- **Expenses is fake data.** `src/features/expenses/data.ts:28` is a hardcoded `DEMO_EXPENSES` array. There's no expenses table in the schema.
- **CashBook is a stub.** `CashBookScreen.tsx` renders `<UnderConstruction />`. So "where did my cash go?" — question 4 of the 4 in `docs/PROJECT.md` — has no implementation and no data source.
- **No schema versioning.** `drizzle.config.ts` points at `src/db/migrations/`, which is **empty**. `migrate.ts` is a hand-written idempotent bootstrap. This works today by luck and becomes a blocker the first time a *data* migration is needed — or the first time a backup is restored across app versions. Stamp `user_version` now; it's nearly free and impossible to retrofit onto files already in the wild.
- **`items.currency` is written but never read.** Every `money.ts` call site omits the currency arg, so EGP/exponent-2 is always assumed. Two places bypass `money.ts` entirely and hardcode `/100` (`inventory/presenters.ts:61,66`), which the header comment in `money.ts` explicitly forbids.
- **`dashboard-stats.ts` monthly profit is an N+1** — `getWithLines` per document. Fine at demo scale; it will not be fine at a year of real sales.
- **`autoFocus` fires on every purchase line row**, not just the newest (`DocLineRow.tsx:68`).

---

## BMAD

Installed at `_bmad/` (v6.10.0, BMM module), 46 skills in `.claude/skills/`. Output folder configured to `docs/bmad/`.

Useful next steps from here:
- `bmad-prd` — turn any of these briefs into a PRD with epics
- `bmad-create-epics-and-stories` → `bmad-create-story` — break a chosen brief into context-complete story files
- `bmad-brainstorming` — another round, interactive this time (Facilitator or Creative Partner stance)
- `bmad-forge-idea` — pressure-test the sync decision if you disagree with the recommendation in brief 3
