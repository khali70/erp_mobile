# Feature 3 — Remote DB for Sync & Backup

**Status:** proposed
**Verdict:** ⚠️ **Split it. The stated goal is right; the proposed solution is the most expensive way to get it.**

- ✅ **Do now — Restore + auto-backup (~1 day).** This is the actual gap, and it needs no server at all.
- ✅ **Do next — Encrypted cloud file drop (~3–4 days).** This delivers "phone stolen or broken" in full.
- ❌ **Don't do — Remote DB / real sync (~4–8 weeks).** It contradicts a locked project principle, and it does not buy you anything the two above don't already deliver.

---

## 1. The thing nobody noticed: **there is no restore.**

`src/features/settings/backup.ts` does this and only this:

1. `PRAGMA wal_checkpoint(TRUNCATE)` — flush WAL (correct; WAL is on because `enableChangeListener` is set)
2. copy `erp.db` and `attachments.db` into `Paths.cache` as `erp-backup-<ISO>.db` / `erp-attachments-<ISO>.db`
3. hand each to `Sharing.shareAsync()` — the OS share sheet, one after the other

**And that's it.** A repo-wide search finds **no import, no restore, no read-back path anywhere.** `expo-document-picker` is installed but is only used for attachments and CSV import.

So today, the honest state of "never lose data" — one of the two stated hills to die on in `docs/PROJECT.md` — is:

> The merchant must **remember**, manually, to open Settings and tap Backup. Then he must **remember** where the share sheet put the file. Then, if his phone dies, **there is no button in the app that brings it back.** Recovery means someone with a computer manually pushing a `.db` file into the app's private storage — which on an unrooted Android phone, for a shopkeeper, is *not a thing that will ever happen.*

**You do not have a backup feature. You have an export button.** That is the problem to fix, and it is not a sync problem.

Two more facts that matter:

- **The backup is unencrypted plaintext SQLite.** It contains every customer's name, phone number, and outstanding debt. Right now it's dropped into a cache directory and pushed through the share sheet — where the merchant will, reasonably, send it to WhatsApp. That is a plaintext customer database sitting in a WhatsApp chat. **Fix this before you upload anything anywhere.**
- **The schema has no migration versioning.** `src/db/migrate.ts` is a hand-written idempotent bootstrap (`CREATE TABLE IF NOT EXISTS` + a stack of `addColumnIfMissing()` calls wrapped in a duplicate-column-swallowing try/catch). `drizzle.config.ts` points at `src/db/migrations/`, which is **empty**. There are no versioned migrations and **no version number stamped in the DB file.** So a backup taken by v1.2 of the app, restored into v1.5, will silently be a v1.2 schema that `runMigrations()` then upgrades on next boot — which happens to work, by luck, because the bootstrap is idempotent. It will stop working the first time you need a *data* migration (backfilling a column, changing a unit). **Stamp `user_version` in the DB file and check it on restore.** Cheap now, load-bearing forever.

---

## 2. Tier 0 — Restore, auto-backup, and honesty. **Do this now.**

No backend. No account. No network. ~1 day. Delivers most of the disaster-recovery value you're asking for.

**Restore**
- `expo-document-picker` → user picks `erp-backup-*.db`
- Validate: is it SQLite (magic header)? Does it have the expected tables? What's its `user_version`?
- **Back up the current DB first** (`docs/PROJECT.md`: *"Backup before any destructive action"*) — a restore is the most destructive action in the app
- Close the DB handles, swap the files, run `runMigrations()`, restart the JS context
- Attachments DB is a **second file** (`attachments-client.ts` → `openDatabaseSync('attachments.db')`). Restore is a **pair**, or you restore documents whose receipts have vanished. Bundle both into one archive so the merchant handles **one file, not two.** Today's flow hands him two share sheets back to back, which is a mistake he *will* make.

**Auto-backup**
- On app background, if > 24h since last backup, snapshot silently to app storage
- Keep the last N (3–7), rotate
- **This is where most of the value is.** A backup the merchant has to remember to take is a backup that doesn't exist.

**Honesty**
- Show "آخر نسخة احتياطية: منذ 3 أيام" in Settings, in red past a threshold
- The merchant currently has **no idea** whether he is protected. Tell him.

---

## 3. Tier 1 — Encrypted cloud file drop. **Do this next.**

This is the tier that actually answers *"my phone was stolen."* ~3–4 days.

**Key insight: you do not need a remote database to survive a stolen phone. You need a remote *file*.**

- Encrypt the backup archive (both `.db` files) with a key derived from a passphrase the merchant sets **once**
- Upload the encrypted blob to storage the merchant already owns — **Google Drive** (he has it, it's free, it's already signed in on the phone, and it costs you zero infrastructure and zero liability)
- On a new phone: install, sign in, pull the latest blob, enter the passphrase, restore
- Alternative if you want it invisible: a single object-storage bucket (Supabase Storage / S3) keyed by an anonymous device id. But **now you are holding other people's customer databases**, and every legal and operational consequence that implies. Drive keeps the blob in the merchant's own account, where it belongs.

**Non-negotiable:** encrypt **before** upload. The blob is a plaintext customer list otherwise.

**Be honest about the passphrase.** If he forgets it, the backup is gone — that is what real encryption means. Say so, loudly, at setup. The alternative (you hold a recovery key) means you can decrypt his customer database, and now you're a target.

---

## 4. Tier 2 — Actual remote DB / sync. **Don't.**

### It contradicts a locked principle

`docs/PROJECT.md`, "Out of scope (**permanent**)":

> Cloud, backend/API, auth/accounts, multi-device sync, roles/RBAC. […] Data safety = **local backup/restore + CSV export**, not cloud.

That line was written for a reason, and the reason is still true. This isn't bureaucratic — it's the single decision that makes the rest of the architecture coherent (synchronous local writes that always succeed, no loading states, no offline queue, identical behaviour in airplane mode).

### It does not solve the problem you stated

You said: *"so if mobile is stolen or breaks."* That is **disaster recovery**. Tier 1 delivers it completely. Sync solves a **different** problem — *two devices editing the same data at the same time* — which, per the project brief, **you do not have**: one shopkeeper, one phone.

**Paying the cost of sync to get the benefit of backup is the single most common way small apps die.**

### What it would actually cost

| Item | Reality |
|---|---|
| Zero network code exists | Repo-wide grep for `fetch(`/`axios`/`supabase`/`http`/`WebSocket` → **no matches** in `src`. You would be adding the first byte of I/O to a codebase whose every architectural assumption is "writes are synchronous and always succeed." |
| Auth | Currently none. Sync requires identity. Identity requires accounts, password reset, session handling, and a support burden. |
| Conflict resolution | Two devices, same document, offline. Last-write-wins **will silently destroy stock movements**, and stock is derived from an immutable ledger — a lost movement is a permanently wrong on-hand quantity that nobody can explain. |
| Schema versioning | Doesn't exist (see §1). Sync across app versions **requires** it. This alone is a prerequisite project. |
| Server | Hosting, uptime, cost, and you are now custodian of every merchant's customer list. |
| Zustand/UI | Every screen assumes data is already there. Sync introduces staleness, loading, and partial states everywhere. |

Realistically **4–8 weeks**, and it makes every future feature slower to build, forever.

### The one thing genuinely in your favour

Your architecture is **unusually well-suited to sync, if you ever do want it.** `docs/PROJECT.md`: *"Movement-log-centric stock — on-hand is derived from an immutable ledger, never a hand-edited number."*

An immutable append-only ledger is **exactly** the data model that syncs cleanly: you ship *events*, not *rows*; you never merge conflicting state because state is derived; two devices that have seen the same set of events compute the same on-hand. This is the hard part of sync, and you got it right by accident (or good taste).

So the door is open. **Just don't walk through it to solve a backup problem.** Walk through it the day you decide the *product* is multi-device or multi-branch — and note that `docs/PROJECT.md` currently says it isn't.

---

## 5. Recommendation

1. **Tier 0 now** — restore, bundled archive, auto-backup, last-backup-age display, `user_version` stamp. ~1 day. Closes a hole in a stated core principle.
2. **Encrypt the backup.** Do not ship a plaintext customer database through a share sheet.
3. **Tier 1 next** — encrypted blob to the merchant's own Google Drive. ~3–4 days. Fully answers "stolen or broken."
4. **Tier 2 — no.** Revisit only if the product direction changes to multi-device/multi-branch. If it does, sync the ledger as an event log, not the tables as rows.

**Blunt version:** you asked for a remote database. What you need is a *restore button* and an *encrypted file in Drive*. One is a day, the other is a few days. The remote database is two months and it makes everything else worse.

---

## 6. Definition of done — Tier 0

- [ ] `user_version` stamped in `erp.db`; checked and refused on downgrade at restore
- [ ] Backup produces **one** archive containing both `erp.db` and `attachments.db` + a manifest (app version, schema version, timestamp, row counts)
- [ ] Restore: pick file → validate → **auto-backup current DB first** → swap → migrate → restart
- [ ] Restore refuses a corrupt/foreign/newer-schema file with a clear Arabic message
- [ ] Auto-backup on background, > 24h since last, rotate last N
- [ ] Settings shows last-backup age, red past 7 days
- [ ] Backup file is encrypted at rest
- [ ] Tested end to end **on the real device**: back up → wipe app data → restore → stock, debts, and P&L all match. Nothing less counts as done.
