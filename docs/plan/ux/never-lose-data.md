# Hill 2 — Never Lose Data Contract

> Checkable spec for draft auto-save/restore, transactions, and soft-delete/undo on the Step-1 hot path.
> Grounded in the current code: `ItemFormSheet` + its stub `onSave`, `DocumentForm` (`useState`-only lines), `drafts.ts`, `document-repository`, `store/mmkv.ts`.
> Foundation already right: **SQLite is the source of truth** (`AGENTS.md`), MMKV holds durable flags (`settings-store`), posting goes through a repository. What's missing is **draft persistence + restore + undo** — none of it exists yet.

---

## 0. The current data-loss bugs (fix before anything else)

These are not future features — they are live ways the app forgets what the owner typed. Detailed diffs in `screen-audit.md`.

- [ ] **B1 — Item Save is a stub.** `ItemsListScreen` passes `onSave={() => setFormOpen(false)}` to `ItemFormSheet`. The typed item is **never written to the repository** — it vanishes when the sheet closes. (Anti-pattern A1.)
- [ ] **B2 — Editing an item blanks cost & barcode.** `drafts.ts#toDraft` returns `costPrice: ''` and `barcode: ''` regardless of the item's real values. Open-edit-save silently wipes the stored cost price and barcode. (Anti-pattern A2.)
- [ ] **B3 — In-progress document lives only in `useState`.** `DocumentForm` holds `lines`, `party`, totals in component state. Backgrounding the app (OS kill) or a crash loses the entire half-entered document. No draft row, no restore. (Anti-pattern A10.)
- [ ] **B4 — Immediate line delete, no undo.** `DocLineRow` `onDelete` removes the line instantly; `ItemFormSheet`/list have no undo. (Anti-pattern A8, reconciles `ux-review` gap #5.)

---

## 1. Draft auto-save — what persists

Two draft kinds: **item drafts** (the add/edit sheet) and **document drafts** (incoming/outgoing editor). Item drafts are cheap and short-lived; document drafts are the expensive ones (many lines) and the real target.

- [ ] **Document drafts persist to SQLite**, not MMKV. A half-entered document is business data with N lines — it belongs in the `documents`/`document_lines` tables with `status = 'draft'` (the schema in `step-1-simple-store.md` already has `status: 'draft' | 'posted'` and draft docs explicitly **do not** affect stock). Persist the draft as a real draft document; posting flips `status → 'posted'` and materializes ledger rows.
- [ ] **Item-sheet drafts persist to MMKV** (small, single, transient) under a fixed key so a mistaken sheet-dismiss can be recovered. Business commit still goes to SQLite on Save.
- [ ] What is captured in a document draft: `type`, `party` ref (or walk-in), `docDate`, every line's `itemId`/`qty`/`unitPrice`, and `sort_index`. Enough to rebuild the editor exactly.
- [ ] What is **not** persisted as draft: derived totals (recompute), UI-only flags (`pickerOpen`).

## 2. Debounce & write cadence

- [ ] Auto-save is **debounced at 500–800 ms** of input-idle, plus a **forced flush** on: app background (`AppState` → `background`/`inactive`), navigation-away, and add/remove-line.
- [ ] Debounce **coalesces** rapid keystrokes into one write — never write per character.
- [ ] Writes are **synchronous SQLite** (expo-sqlite) — no `await` that could be interrupted, no spinner. This is the "offline-first, never a spinner that drops input" rule from `AGENTS.md`.
- [ ] A flush **on background is not debounced** — it runs immediately, because the OS may kill the process moments later.

## 3. Storage key shape

- [ ] Document draft = a row in `documents` with `status='draft'`; there is **at most one active draft per `type`** on the editor at a time (owner edits one incoming + one outgoing max). Reopening the editor loads the existing draft rather than starting blank.
- [ ] Item-sheet MMKV key: `draft:item:new` for the add form; edit drafts key by id: `draft:item:<itemId>`. Value = the JSON `ItemDraft` shape from `types.ts`.
- [ ] Last-used defaults (Hill 1 §7) are separate keys in MMKV: `lastUsed:item:unit`, `lastUsed:item:category`, `lastUsed:doc:date`. Not drafts — they survive Save.
- [ ] Keys are namespaced and versioned (`draft:v1:...`) so a schema change can invalidate stale drafts cleanly.

## 4. Restore-on-launch UX

- [ ] On editor mount, if a draft document exists for that `type`, **load it silently** into the form (no modal wall) and show a **dismissible banner**: "استُعيدت مسودة غير محفوظة" (an unsaved draft was restored) with a "تجاهل" (discard) action.
- [ ] The restore banner's **discard** soft-deletes the draft (see §6), it does not hard-delete — a mis-tap on discard is itself recoverable via undo.
- [ ] For the **item sheet**, if a `draft:item:*` exists on open, prefill from it and show the same lightweight "restored" hint; clear the MMKV key on successful Save or explicit discard.
- [ ] Restore is **instant** (synchronous read) — never a loading screen.
- [ ] Never auto-restore into a *different* document than the one being opened — match on `type` (and id for edits).

## 5. Transaction rules (posting is atomic)

- [ ] Posting a document runs in **one SQLite transaction**: insert/flip header, write all `document_lines`, materialize all `ledger_entries`, update cached `total_amount`. Partial posts are impossible. (`document-repository.create` is the choke point — verify it wraps in `db.transaction`.)
- [ ] The negative-stock guard runs **inside** the transaction and **rolls back** on violation — `DocumentForm` already surfaces `NegativeStockError` via `Alert`; ensure the throw aborts the whole transaction, leaving no half-written lines/ledger.
- [ ] `allowNegativeStock` flag is read from the durable settings store (`settings-store`, MMKV) — already wired in `DocumentForm`. Keep the flag durable so behavior survives restart.
- [ ] Draft→posted is a **status flip + ledger materialize**, never a delete-then-recreate — the draft's id and lines carry through so nothing is orphaned.
- [ ] Editing a **posted** document does not mutate ledger rows in place; it unposts (removes materialized entries) and reposts in one transaction, or records a correcting document. Posted docs are **append-only** at the ledger level.

## 6. Soft-delete & undo policy

- [ ] **No hard-delete of an item that has ledger history.** Items use `is_archived` (schema already has it) — delete = `is_archived = 1`. The stock/movement history remains intact and queryable.
- [ ] **Line delete inside the editor shows an undo.** Replace `DocLineRow`'s immediate `removeLine` with a remove-then-**undo-toast** (5 s): the line is held in a "pending delete" buffer and re-inserted at its `sort_index` if undo is tapped. (Reconciles `ux-review` gap #5.)
- [ ] **Item archive shows an undo** toast from `ItemsListScreen` — archive is reversible for the toast window, and always reversible from an "archived items" view later.
- [ ] Undo restores to the **exact prior position/state**, not appended to the end — preserve `sort_index` / list order.
- [ ] Destructive actions never chain a blocking confirm dialog **and** an undo — pick undo (faster, non-blocking) for reversible ops; reserve confirm only for truly irreversible ones (none exist in Step 1).

## 7. Offline-first guarantees

- [ ] Every write path is local SQLite and **succeeds without network** — no code path awaits a server. `AGENTS.md`: "The app must feel identical in airplane mode."
- [ ] No spinner sits on the hot path between a keystroke and its persistence.
- [ ] Repository is the **only** layer touching the DB (`AGENTS.md` layering) — drafts, posts, archives all go through it, so persistence stays swappable and testable.

---

### Per-screen Safety score (see `screen-audit.md` for the diffs)
| Screen | Safety | One-line reason |
|---|---|---|
| HomeScreen | 3 | Read-only dashboard; no data to lose (static demo today) |
| ItemsListScreen | 0 | Passes a **stub Save** — new items are never persisted (B1) |
| ItemFormSheet | 0 | Save handler is external stub + edit blanks cost/barcode (B1, B2) |
| LineItemPicker | 2 | Selection is transient by design; no persistence concern of its own |
| DocLineRow | 1 | Immediate delete, no undo (B4); qty edits are in-memory only |
| DocumentForm | 0 | Whole document in `useState`, no draft, no restore (B3) |
| ItemMovementScreen | 3 | Read-only ledger view; nothing to lose |
