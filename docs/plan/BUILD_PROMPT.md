# BUILD_PROMPT — paste into a fresh Claude Code session to build the app

Copy everything inside the fenced block below and send it as your first message.

---

```
Build the Step-1 mobile app end-to-end using a multi-agent Workflow, driven on a /loop so it resumes until done. This is an explicit opt-in to multi-agent orchestration — use the Workflow tool.

## Source of truth (read FIRST, do not invent scope)
- /Users/khali/Code/erp_mobile/AGENTS.md         → architecture rules (HARD, review-blocking)
- /Users/khali/Code/erp_mobile/docs/plan/00-findings-so-far.md
- /Users/khali/Code/erp_mobile/docs/plan/step-1-simple-store.md   → THE Step-1 scope + backlog (M0→M4)
- /Users/khali/Code/erp_mobile/docs/plan/data-model.md           → Drizzle/expo-sqlite schema + migrations
- /Users/khali/Code/erp_mobile/docs/plan/roadmap.md              → phases (context only; build Step 1 only)

Build ONLY Step 1: inventory items + income ledger (incoming) + export ledger (outgoing) + computed on-hand + stock movement. No parties, expenses, multi-store, or extra reports.

## North star for every UI/UX decision (non-negotiable — "two hills to die on")
1. SPEED OF DATA ENTRY. The owner enters documents all day. Optimize keystrokes/taps:
   - Numeric keypad by default for qty/price; auto-advance focus; add-line without leaving keyboard.
   - Barcode/scan-to-add-line; last-used values remembered; item search is instant (indexed, fuzzy).
   - Big tap targets (>=44px), one-thumb reach, minimal modals, no dead-end confirmations.
   - "Save = one tap, always visible." Draft auto-persists so a mistap never restarts entry.
2. NEVER LOSE DATA. Treat every keystroke as sacred:
   - Auto-save drafts to SQLite on every change (debounced), restore on relaunch/crash.
   - All writes in transactions; posted documents are append-only ledger truth.
   - No destructive action without undo or archive (soft-delete only; hard-delete of items with history is BLOCKED).
   - Offline-first: never a spinner that can drop input; queue + persist locally.
Every screen the UI/UX agent reviews must be scored against these two hills explicitly.

## Roles (each agent() gets a role system-prompt)
- Senior RN/Expo Engineer — writes code, conforms to AGENTS.md layering, NativeWind, RTL, Drizzle services.
- Senior UI/UX Engineer — reviews every screen ONLY through the two-hills lens above + RTL/Arabic + a11y (44px, labels). Returns concrete diffs, not vibes.
- Data/Integrity Engineer — reviews persistence: transactions, migrations, draft auto-save, ledger correctness, on-hand math.
- Quality Reviewer (adversarial) — hunts correctness bugs + AGENTS.md hard-rule violations. Default skeptical.

## Workflow shape (author it, then run it)
- phase M0 Scaffold: Expo SDK 54 project, deps (expo-sqlite, drizzle, nativewind, react-navigation, tanstack-query, zustand, expo-image-picker, expo-crypto), path aliases, theme tokens, i18n (ar default, RTL), folder skeleton per AGENTS.md, navigation shell. Single focused agent; then Quality Reviewer gate.
- phases M1→M4: pipeline the backlog items from step-1-simple-store.md. Per item:
    stage1 Engineer builds → stage2 UI/UX review (two hills) + Data/Integrity review in parallel → stage3 Engineer applies fixes → stage4 Quality Reviewer adversarial pass; loop stage3↔stage4 until zero blocking findings.
- phase Verify: run `npx tsc --noEmit`, eslint, jest; then drive the app (Maestro flow or scrcpy screenshot) to prove: add item → post incoming (+qty) → post outgoing (−qty) → on-hand correct → movement lists both → kill app mid-entry → draft restored. Report evidence.

## Quality gates (a slice is NOT done until ALL pass — guarantee, not aspiration)
- `tsc --noEmit` clean, `eslint` clean (AGENTS.md custom rules: no StyleSheet, no fetch outside services, no feature→feature imports, no process.env outside config, no React.FC, RTL logical props only).
- Colocated tests exist for: every service method (happy + 1 failure), stock/on-hand math, draft auto-save/restore, post/unpost ledger effect. Jest green.
- Quality Reviewer returns zero CONFIRMED blocking findings.
- The two-hills acceptance (fast entry + crash-safe draft) demonstrated in Verify, not just claimed.
- Commit each finished slice on a feature branch (never main): message ends with the Co-Authored-By trailer. Do not push unless I ask.

## /loop behavior
- Each fire: pick the next unchecked backlog item in step-1-simple-store.md, run ONE Workflow slice (build→review→fix→verify→commit), tick the checkbox in the doc, then schedule next wake. Resume via runId so completed slices don't rebuild.
- Stop the loop when every Step-1 backlog box is checked and the full Verify flow passes. Post a final summary: what shipped, test results, screenshots, open risks.
- If blocked on a real decision (valuation method, negative-stock policy, a missing dep needing my approval), STOP and ask me — do not guess on money/data-integrity choices.

Start by reading the four docs + AGENTS.md, draft the Workflow script, show me the phase plan and the M0 scaffold decisions, then begin.
```

---

## Overnight autonomous addendum (paste this too, so it never stalls while you sleep)

```
OVERNIGHT AUTONOMOUS MODE. I am away. Do not stop to ask me — these decisions are pre-made; use them and keep going:
- Valuation method = weighted-average.
- Negative stock = BLOCKED by default, behind a configurable `allowNegativeStock` flag (default false).
- Single currency, single local store, no auth (local-only device) for Step 1.
- Any missing dev dependency that is a standard Expo/RN package from the doc's list = install it, note it in the commit body. Only a NON-listed new dependency category needs me.
- Commit every finished slice to a feature branch. NEVER push. NEVER touch main.
- If a slice fails its quality gate 3 times, skip it, leave its backlog box unchecked, log why, and move to the next slice — do not halt the whole loop on one stuck item.
- Keep going until every Step-1 backlog box is checked OR you run out of safe work. Then write a final report to docs/plan/BUILD_REPORT.md (what shipped, tests, skipped items + reasons, next actions) and stop the loop.
- Use runId resume so nothing rebuilds. Persist progress by ticking checkboxes in step-1-simple-store.md as you finish each item — that is the durable state if the session restarts.
```

## How to use it

- **Full auto (drip):** prefix the block with `/loop ` when you send, so it self-paces and resumes each slice.
- **One shot:** send the block as-is → it runs one big Workflow through all of Step 1.
- **Cadence tip:** the loop schedules its own wake; no interval needed. It stops itself when the backlog is fully checked.
- **Cost:** many agents = real tokens. It commits per slice, so progress survives interruption and you can stop anytime.
