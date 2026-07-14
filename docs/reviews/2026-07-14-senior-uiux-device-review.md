# Senior UI/UX Review — On-Device, Pre-Release

**Date:** 2026-07-14
**Device:** Samsung SM-G781W (`RFCT805GZQH`), Android, 1080×2400
**Package:** `com.khali70.erpmobile`
**Build under review:** the installed dev-client, loading the current JS bundle (the stack's UI as of `43b4c67`)
**Method:** manual walkthrough driven over `adb`, 11 screenshots (`shots/01..11`). `expo-mcp` and `mobile-mcp` were not connected in this session, so the walkthrough was driven by `adb shell input` + `screencap` instead.
**Data:** the owner's real on-device database — 6 items, 8 documents, 2 suppliers. Not a fixture.

---

## Verdict

**Ship the stack.** The supplier-debt / cash-book epic behaves correctly on a real device against a real database, and the two things most likely to be wrong — the money arithmetic and the stock ceiling — are both right. Nothing found here blocks release.

Four cosmetic/affordance defects are listed below. All are display-layer; none corrupt data. The most valuable one (P1) is a KPI that shouts danger at a man who owes nothing.

---

## What was verified working

### The cash book reconciles against the drawer

The whole feature exists to make one number checkable. It checks out:

| Row | Amount |
|---|---|
| بيع (in) | + ٤٬٥٥٠٫٠٠ |
| بيع (in) | + ٣٬٠٠٠٫٠٠ |
| سداد مصروف (out) | − ٣٠٠٫٠٠ |
| سداد مصروف (out) | − ٣٠٠٫٠٠ |
| سداد مصروف (out) | − ٤٠٠٫٠٠ |
| سداد لمورد (out) | − ٦٬٠٠٠٫٠٠ |
| **نقدي** | **+ ٥٥٠٫٠٠** |

The sum is exactly the نقدي card. Directions and colours are right (in = green, out = red), مبيعات اليوم (٧٬٥٥٠٫٠٠) equals the two sale rows, and the نقدي/إنستاباي split is preserved.

### Debt derivation is coherent across screens

Home's payables KPI reads **٠ ج.م**, and «اللي عليّا» independently renders its empty state («مفيش عليك حاجة 🎉»). Two screens, two separate derivations, same answer — which is the invariant the epic is built on. The supplier was fully settled by the − ٦٬٠٠٠ row above, so zero is the truth.

### Money formatting

Every money figure carries two decimals and Arabic-Indic digits with the thousands separator: `١٬٣٠٠٫٠٠ ج.م`. The rounding bug that silently ate piasters is gone from these surfaces.

### Feature 05 — the stock ceiling — works, at both gates

1. **At selection:** the item picker defaults to **«المتوفر»**, with **«إظهار غير المتوفر»** as an explicit escape hatch. The zero-stock shoes are simply not offered. Every row states الرصيد, and low-stock items carry a «منخفض المخزون» chip.
2. **At quantity:** with 2 hoodies in stock, `+` raised the line to 2, then **greyed out and went inert** — a third tap did nothing — and an inline warning appeared: **«المتاح ٢ فقط»**.

This is the right shape. The `+` becomes *visibly* disabled rather than silently ignoring the tap; a control that ignores you is a bug the user blames on himself.

### The Reports hub

The cash book has a home. التقارير → دفتر النقدية / اللي عليّا / المصروفات, with الأرباح والخسائر and ديون الزبائن honestly marked «قريبًا» rather than shipped as dead links.

---

## Findings

### P1 — The payables KPI shouts danger at a man who owes nothing

`src/features/inventory/screens/HomeScreen.tsx:191-200`

At **٠ ج.م** the card still renders the red dot, the red text, the red pill, and the words **«واجبة السداد (اضغط للتفصيل)»**. Owing nothing is the *good* state and it is being coloured like the bad one. It also invites a tap through to a screen that can only say "nothing here."

The colour should be derived from the value, not fixed: at zero, go neutral (or positive) and say so — «مفيش عليك حاجة» — and drop the affordance to drill in.

### P2 — A document count wears an alert badge

`src/features/inventory/screens/HomeScreen.tsx:62, 69`

المستندات carries a **red badge «٨»** that is pixel-identical to the البضائع **red badge «٣»**. But the ٣ is a *low-stock alert* — something is wrong and needs attention — while the ٨ is just how many documents exist. Same colour, opposite meanings. The doc-count badge should be neutral; red must be reserved for the thing that is actually wrong.

### P3 — «حفظ المستند» looks enabled on an empty document

`src/features/documents/screens/NewOutgoingScreen.tsx` (save button)

With zero lines, the save button is full-teal and reads as pressable. It should be disabled until the document has at least one line. There is also a **duplicate save ✓ in the header** next to the full-width save button at the bottom — two controls, one action, one screen.

### P4 — A controlled numeric field echoes back Latin digits

`src/features/documents/components/DocLineRow.tsx`

Typing `١٠٠٠` now parses correctly (fixed in `d7ad0b9`), but the controlled `TextInput` echoes `1000` back. Functional, and no longer a data bug — but jarring in an Arabic-first UI, and worth rendering back in Arabic-Indic digits.

---

## Fixed during this review

**Arabic keypad could not enter money** — committed as `d7ad0b9`.

Two money inputs never normalized Arabic-Indic digits:

- `useExpenseForm.setAmount` stripped every character outside `[0-9.]`, and ٠-٩ *are* outside `[0-9.]`. Every digit the owner pressed was deleted before it reached the draft. The box stayed empty, the save button never lit, **and the expense could not be recorded at all.**
- `DocLineRow.parseNum` did not refuse — it *agreed*. A unit cost typed `١٠٠٠` parsed to `NaN → 0`; one typed `1,000` became `1.000` → **1**. A cost of 1 where 1000 was meant then feeds weighted-average valuation, where it is never seen again.

Both now route through `normalizeDigits` before parsing. The expense form gained its first hook test (5 cases, real repository over real SQL) pinning ١٠٠٠, the Arabic decimal separator ١٢٫٥٠, the thousands separator ١٬٠٠٠ the app itself prints, and the two refusals.

---

## Not a defect

The grey **gear circle** floating over the UI in every screenshot is the **Expo dev-client floating menu bubble**, not an app element. It appears at the same screen position regardless of route, and it will not exist in the release APK. It is called out here because it is the single most conspicuous thing in the captures and reads, at a glance, like a rendering bug.

---

## Suite status at review time

- `npm test` — **306 passed / 306**, 23 suites, 2 projects
- `npx tsc --noEmit` — clean
- ar/en key parity — 417 / 417
