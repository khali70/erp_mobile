# Feature 1 — Hide/Show Stock & Revenue on Dashboard ("Privacy Mode")

**Status:** proposed
**Verdict:** ✅ **Build it. High value, low cost (~0.5–1 day).**
**But:** what you asked for is *privacy*, not *security*. Ship both, in that order — they are different features solving different threats.

---

## 1. What exists today

`src/features/inventory/screens/HomeScreen.tsx` (route `Home`, the initial route) renders exactly **three** KPI cards (L178–210):

| Card | Source field | i18n key |
|---|---|---|
| Stock value | `stats.inventoryValue` | `dashboard.kpi.stockValue` |
| Monthly profit | `stats.monthlyProfit` | `dashboard.kpi.profit` |
| Supplier payable | `stats.supplierDebt` | `dashboard.kpi.payable` |

Numbers come from `src/features/inventory/dashboard-stats.ts` → `computeDashboardStats()`, served via `hooks/useDashboardStats.ts`.

**Note:** there is **no revenue KPI on the dashboard today.** You asked to hide "revenue" — the closest thing shipped is *monthly profit*. Either the feature means "hide profit", or a revenue card needs adding first. Assume the former; the mechanism covers both regardless.

Settings live in `src/store/settings-store.ts` — zustand + `persist` over MMKV (`src/store/mmkv.ts`, id `erp-settings`), currently holding **one** flag: `allowNegativeStock`. MMKV is synchronous, so there's no hydration flash. This is the right place for a privacy flag.

**There is no app lock.** `expo-local-authentication` and `expo-secure-store` are both in `package.json` and **neither is imported anywhere in `src`**. They are dead dependencies you already pay the bundle cost for.

---

## 2. Opinion — the threat model matters, and it decides the design

Be precise about *who* you're hiding from, because the two answers need completely different code.

**Threat A — the shoulder.** A customer leans over the counter. An employee walks past. A relative picks up the phone to look at photos. They see "stock value: 340,000 EGP" and now they know what the shop is worth, or what you earn. **This is the threat you actually have.** It's constant, it's low-effort for the attacker, and it's what makes a shopkeeper uncomfortable opening the app in front of people.

**Threat B — the adversary.** Someone has your unlocked phone and *wants* your numbers. A toggle in settings stops them for four seconds.

A hide/show toggle solves **A completely** and **B not at all**. That's fine — A is the real problem — but do not let the toggle create a false sense of B. If the phone is unlocked and in someone else's hands, everything is gone regardless: the `.db` file, the documents list, the reports screen, the parties screen with every customer's debt.

So:

- **Privacy Mode (this feature)** = masking. Cheap, high daily value, solves the shoulder.
- **App Lock (companion feature)** = PIN/biometric gate on cold start and on resume-from-background. Solves the adversary. The deps are already installed. `docs/PROJECT.md` explicitly allows it: *"App-lock (PIN/biometric) is the only optional gate."*

Ship Privacy Mode first (it's a day). Ship App Lock next (it's another day). Don't ship Privacy Mode and call the app secure.

---

## 3. Design

### 3.1 Masking, not removing

Don't hide the card. **Mask the value, keep the card.** A missing card teaches the user nothing; a masked card says "this is here, it's protected, tap to see it."

```
┌─────────────────┐      ┌─────────────────┐
│ قيمة المخزون     │  →   │ قيمة المخزون     │
│ 340,500 ج.م     │      │ ••••••  👁       │
└─────────────────┘      └─────────────────┘
```

### 3.2 Interaction

- **Eye icon in the Home header** toggles the whole dashboard between masked/revealed. One tap, no menu-diving. This is the primary control — the shopkeeper needs it *fast*, at the moment a customer walks up.
- **Tap an individual masked card** to reveal just that one.
- **Auto re-mask.** This is the part people skip and it's the part that makes the feature actually work:
  - on `AppState` → `background`/`inactive` (re-masks before the app-switcher snapshot is taken, which is also where the OS screenshots your screen)
  - after N seconds of inactivity while revealed (default 30s)
- **Default state** is a setting: "start masked" on/off. Recommend **on** by default once the merchant opts into privacy mode at all.

### 3.3 Scope of masking — do not stop at the dashboard

Masking three cards while the Reports screen prints the same numbers in full is theatre. Cover every screen that shows aggregate money:

- `HomeScreen` KPI cards (all three)
- Reports screen (`src/features/reports`) — totals, profit, stock valuation
- Inventory list — the per-item value column, if present
- Parties list — customer/supplier balances (`DebtBadge`)

Per-line prices *inside a document* should stay visible — you're often showing that screen to the customer on purpose.

### 3.4 Granularity

Don't build a per-card checkbox matrix. One `privacyMode: boolean` covering the money-aggregate class of value. If real usage shows people want "hide profit but show stock", add it then. Not before.

---

## 4. How to apply

**Store** — `src/store/settings-store.ts`, extend the persisted slice:

```ts
privacyMode: boolean;          // feature on/off
startMasked: boolean;          // mask on every cold start / resume
setPrivacyMode: (v: boolean) => void;
setStartMasked: (v: boolean) => void;
```

Keep the *transient* revealed/masked state **out of the persisted store** — put it in a small non-persisted zustand store (`src/store/ui-store.ts` already exists and is nearly empty) or a context. Persisting "currently revealed" would survive a restart, which is exactly wrong.

**Component** — new shared `src/components/MaskedValue.tsx`:

```tsx
// Renders children when revealed, a dot-run + eye affordance when masked.
// Width-stable so cards don't reflow on toggle.
<MaskedValue>{stats.inventoryValue}</MaskedValue>
```

Width stability matters: if the mask is narrower than the number, the grid jumps every toggle and it feels broken. Render the dots at the same measured width, or give the card a fixed-height/min-width.

**Auto re-mask** — one `useEffect` on `AppState.addEventListener('change', ...)` in the privacy provider, plus a `setTimeout` reset on each reveal.

**Header control** — eye icon in the `Home` header (`RootNavigator.tsx` screen options, or inside `HomeScreen`'s own header row at L144–157 next to the existing refresh button).

**Settings UI** — `SettingsScreen.tsx` currently has two sections ("المخزون", "البيانات والنسخ الاحتياطي"). Add a third: **"الخصوصية"** with the `privacyMode` switch and the `startMasked` switch beneath it (disabled when privacy mode is off).

**i18n** — Arabic first, per project convention: `settings.privacy.*`, `dashboard.kpi.hidden`.

### Optional hardening (cheap, do it while you're here)

`FLAG_SECURE` on the Android window blocks screenshots *and* blanks the app-switcher thumbnail. One native call, and it kills a whole class of accidental leak (a screenshot of the dashboard sitting in the phone's gallery, auto-uploaded to Google Photos). Gate it behind the privacy-mode setting so users who don't care aren't blocked from screenshotting.

---

## 5. Is it worth it?

**Yes — this is the best cost-to-perceived-value ratio of the four features.**

- **Cost:** ~0.5–1 day. No schema change, no migration, no new dependency, no risk to the money/stock ledger. It's presentation-layer only.
- **Value:** it removes a real, daily, felt friction — the shopkeeper who hesitates to open his own app in front of a customer. That hesitation is the kind of thing that quietly kills adoption, and it never shows up in a bug report.
- **Risk:** essentially zero. Worst case, a number is hidden when the user wanted it shown, and they tap once.

**The trap to avoid:** shipping this and considering "security" done. The dashboard is the *least* sensitive screen in the app. The parties list — every customer's name, phone, and debt — is far more damaging, and so is the unencrypted `.db` file that `backup.ts` drops into the cache directory (see Feature 3). Privacy Mode is a good feature. It is not a security feature. Follow it with the app lock, and encrypt the backups.

---

## 6. Definition of done

- [ ] `privacyMode` + `startMasked` persisted in `settings-store`
- [ ] Transient reveal state is **not** persisted
- [ ] `MaskedValue` component, width-stable
- [ ] Applied to Home KPIs, Reports totals, party balances
- [ ] Eye toggle in Home header, one tap
- [ ] Auto re-mask on `AppState` background + 30s idle
- [ ] Settings section in Arabic, RTL-correct
- [ ] (optional) `FLAG_SECURE` when privacy mode is on

## 7. Follow-on (separate brief, do not fold in)

**App Lock** — PIN + biometric gate on cold start and resume. `expo-local-authentication` + `expo-secure-store` are already installed and unused. Explicitly sanctioned by `docs/PROJECT.md`. Estimated ~1 day. This is the feature that actually protects data.
