# UX Manifesto — Two Hills to Die On

> Scope: **Step 1** (inventory items + incoming/outgoing ledger + computed on-hand + stock movement).
> Audience: everyone touching a Step-1 screen or component under `src/features/`.
> These docs **audit the real code** (as of this pass) and hand you concrete, file-named fixes.
> They **reconcile with** `../ux-review-design-prototype.md` (the web-mock UX review) — that doc reviews the *throwaway prototype*; **these docs review the shipping RN app**. Where they overlap (undo, scan, existing-party search) it is called out, not re-argued.

---

## The two hills

The owner is one person, standing behind a counter, entering documents all day, often offline. Every screen serves exactly two masters. If a change helps neither, it is not a priority. If a change hurts either, it does not ship.

### Hill 1 — SPEED OF DATA ENTRY
The owner enters documents all day. Taps and keystrokes are the currency; we spend as few as possible.
- Numeric keypad by default for every qty / price / barcode field.
- Auto-advance focus (name → price → qty → next line) via `returnKeyType` + `onSubmitEditing`.
- Add-a-line **without dismissing the keyboard** or re-opening a picker per item.
- Barcode / scan-to-add as a first-class add path, not a dead button.
- Remembered last-used values (unit, category, store, date, party).
- Instant fuzzy item search (name **and** barcode), not a case-sensitive substring.
- Big tap targets — **≥ 44×44 px** — reachable one-thumb.
- Minimal modals, no dead-end confirmations.
- **Save is one tap and always visible.**

### Hill 2 — NEVER LOSE DATA
Every keystroke is sacred. The owner never re-types anything because the app forgot.
- Debounced auto-save of in-progress drafts to SQLite (see `never-lose-data.md` for the contract).
- Restore-on-relaunch / after-crash, with a visible "draft restored" cue.
- All multi-row writes in a single transaction (posting a document is atomic).
- Posted documents are append-only; corrections are new documents, never silent overwrites.
- Soft-delete + undo only. No hard-delete of anything with ledger history.
- Offline-first: writes hit local SQLite synchronously and always succeed — **never a spinner that can drop input.**

---

## Anti-patterns these hills forbid

| # | Anti-pattern | Which hill it violates |
|---|---|---|
| A1 | A form whose **Save handler drops the data** (stub / `() => {}` / just closes the sheet) | Hill 2 |
| A2 | Editing an entity that **blanks fields it didn't touch** (e.g. cost/barcode reset to `''`) | Hill 2 |
| A3 | A **dead scan button** (`onScanPress={() => {}}` or nav to an UnderConstruction screen) | Hill 1 |
| A4 | Quantities entered **only** by tapping `+`/`−` — no direct numeric entry | Hill 1 |
| A5 | A field the owner **cannot fill at all** (e.g. purchase unit-cost with no editable input) | Hill 1 |
| A6 | **Re-opening a picker per item** — keyboard/modal dismissed after every add | Hill 1 |
| A7 | Tap targets **< 44 px** on the hot path (steppers, edit/delete, close) | Hill 1 |
| A8 | **Immediate destructive delete** with no undo | Hill 2 |
| A9 | Case-sensitive **substring** search where fuzzy / barcode match is expected | Hill 1 |
| A10 | In-progress document/item held **only in React `useState`** — lost on background-kill | Hill 2 |
| A11 | Hardcoded values presented as data (date `6/7/2026`, store, `1000` cash default) | both |
| A12 | Keyboard covers the Save button (no `KeyboardAvoiding` / no sticky Save) | Hill 1 |

---

## Scoring rubric — 0–3 per hill, per screen

Score **every** Step-1 screen against **both** hills. A screen has two scores, e.g. `Speed 1 / Safety 0`.

**Speed of data entry**
- **0** — Blocks fast entry: a required value can't be entered, or every line costs a modal round-trip.
- **1** — Works but slow: stepper-only qty, non-fuzzy search, sub-44px targets, no focus advance.
- **2** — Fast on the common path; one or two friction points remain (no last-used, no scan).
- **3** — Keypad-first, focus auto-advances, add-line keeps flow, scan works, targets ≥44px, Save always one tap.

**Never lose data**
- **0** — Actively loses data: Save is a stub, edit blanks fields, or the doc lives only in `useState`.
- **1** — No auto-save; a crash/background-kill loses the in-progress entry, but committed writes are safe.
- **2** — Drafts persist but restore UX or undo is missing/rough.
- **3** — Debounced draft persist + restore-on-launch cue + atomic posting + soft-delete/undo. Nothing typed is ever lost.

**Rule:** never raise a Speed score by weakening Safety (or vice-versa). A "faster" flow that drops a keystroke scores **0** on Safety regardless of how quick it feels.

---

## How to use these docs

1. `data-entry-speed.md` — the Hill 1 playbook. Every item is a checkbox; treat it as the Definition of Done for keyboard/focus/scan/search behavior.
2. `never-lose-data.md` — the Hill 2 contract. The draft auto-save/restore spec, transaction rules, and soft-delete/undo policy — checkboxes.
3. `screen-audit.md` — per-screen scores + concrete fix diffs (named file, prop/className/handler, and why). Findings ranked most-impactful first. **Start here** if you're fixing something today.

Style law (matches the rest of `docs/plan/`): Arabic-aware, checkbox-driven, name the file and the exact symbol. No vibes — every "fix" points at a line you can change.
