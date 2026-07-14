# FEATURE NAME

Dynamic Configuration & Localization Hardening (de-hardcode `ar.json` / `en.json`)

---

## CONTEXT

`src/i18n/locales/ar.json` and `en.json` (410 lines each) are being used as a **config store**, not a translation store. Values that belong to the business profile, to SQLite lookup tables, or to runtime computation are frozen as literal strings in both files — so changing them means editing translations, and they can never differ per-user.

Audit results (each verified against its consumer):

| # | Locale key(s) | Hardcoded value | Why it's wrong |
|---|---|---|---|
| 1 | `common.currency` | `"EGP"` / `"ج.م"` | Currency is business config, not a translation. Consumed at 10+ sites (`presenters.ts:66`, `parties/presenters.ts:24`, `DocumentDetailScreen.tsx:89,153,158`, `ExpensesScreen.tsx:24`, `ExpenseRow.tsx:29`, `HomeScreen.tsx:43`). |
| 2 | `expenses.form.amount` | `"Expense amount (EGP)"` / `"(ج.م)"` | Currency **baked into the label prose**. Must be `{{currency}}` interpolation. |
| 3 | `dashboard.defaultStore`, `documents.outgoing.defaultStore` | `"Main Store"` / `"المحل الرئيسي"` | Store name. Rendered as the header title at `HomeScreen.tsx:116`. |
| 4 | `documents.incoming.defaultStore` | `"Main Warehouse"` / `"المستودع الرئيسي"` | Warehouse name — same problem, second copy. |
| 5 | `common.appName`, `home.title` | `"ERP Mobile"` | Business/shop name — the owner's, not ours. |
| 6 | `inventory.categories.*` | 7 fixed labels (tshirts, jackets, shoes, pants, shirts, accessories, other) | A `categories` **SQLite table and `category-repository` already exist**, and the item form already has "New category" (`inventory.form.addCategory`). User-created categories have no `i18nKey`, so `presenters.ts:40` / `CategorySelect.tsx:38` can only label the 7 seeded ones. |
| 7 | `inventory.units.piece/pair` | 2 fixed units | Closed list, mirrored by `const UNITS` in `features/inventory/mappers.ts:4`. No user-defined units possible. |
| 8 | `expenses.filters.*` | 5 fixed categories | Duplicated **three times**: locale keys, `CATEGORY_META` (`features/expenses/data.ts:17`), and `const CATEGORIES` (`AddExpenseSheet.tsx:10`). No expenses table in `db/schema.ts` at all. |
| 9 | `dashboard.banner.line` | `"Collected 74% of credit invoices"` | **A fabricated statistic frozen in a translation file.** Must be computed from documents and interpolated. |
| 10 | `home.footer` | `"Step 1 shell — DB ready"` | Dev scaffolding string shipped to users. |
| 11 | `inventory.demo.item1…item6` | 6 fake product names | Seed/demo data living in the locale bundle. |
| 12 | `settings.privacy.startMasked.hint` | `"…after 30 seconds idle"` | The real idle constant lives in code; the prose will silently drift out of sync. |

Additionally, **`src/i18n/index.ts:18` hardcodes `const lng = "ar"`** while `deviceLang` is computed on the line above and then never used. There is no language switcher and no persisted language choice — so `en.json` is currently unreachable at runtime.

**The invariant to establish:** locale files contain *only* translatable UI strings with `{{interpolation}}` placeholders. Every value that a shop owner could reasonably want to change lives in `settings-store` (device config) or SQLite (user data).

---

## REFERENCE

No new screen design required. Extend the existing `src/features/settings` screen (`SettingsScreen`, with its existing `section` / `label` / `hint` row pattern — see the `stock`, `privacy`, and `data` sections) with two new sections: **Business profile** and **Language**. Reuse the existing settings row and toggle components verbatim.

---

## DATA SPEC

Local SQLite (Drizzle) + MMKV-persisted Zustand. No REST backend.

**A. `settings-store.ts` (extend the existing store — MMKV-persisted, same `persist` pattern)**

```
businessName: string          // default: '' → falls back to t('common.appName')
currencyCode: string          // default: 'EGP'
defaultStoreName: string      // default: '' → falls back to t('dashboard.defaultStore')
defaultWarehouseName: string  // default: '' → falls back to t('documents.incoming.defaultStore')
language: 'ar' | 'en' | 'system'   // default: 'system'
+ matching setters
```

Currency **display symbol** resolves through a new `src/utils/currency.ts` map (`EGP → ج.م / EGP`, `SAR`, `AED`, `USD`) keyed by `currencyCode` and the active language — so the symbol stays translatable while the *code* stays config.

**B. New Drizzle table: `units`** (mirrors the existing `categories` table shape)

```
id: text (uuid, pk)
name: text (not null)             // user-entered label
i18nKey: text | null              // set for seeded rows ('piece', 'pair'), null for user rows
sortOrder: integer
createdAt: integer (epoch ms)
```

Generated migration + seed of the two current units. New repository `src/repositories/unit-repository.ts`: `listUnits()`, `createUnit(input)`, `deleteUnit(id)`.

**C. New Drizzle table: `expense_categories`** (same shape as `units`), seeded with the 5 existing keys. New `src/repositories/expense-category-repository.ts` with the same three methods. `CATEGORY_META`'s icon/color mapping stays keyed by `i18nKey`, with a neutral fallback for user-created rows.

**D. Label-resolution rule (one shared helper, used by categories, units, and expense categories)**

```
row.i18nKey ? t(`<ns>.${row.i18nKey}`) : row.name
```

Seeded rows stay translated; user-created rows show their literal name. Put this in one place — `presenters.ts:40` already does it for categories and must not be re-implemented per feature.

---

## BEHAVIOR

**Business profile section (Settings)**

- Text inputs for business name, default store name, default warehouse name; a picker for currency code.
- Empty input → the locale default is used (never a blank header). Persisted to MMKV; survives cold start.
- Saving the business name updates the home header and app title immediately (Zustand subscription, no restart).

**Language section (Settings)**

- Segmented control: System / العربية / English. Persisted.
- On change: call `i18n.changeLanguage`, recompute RTL, and — because `I18nManager.forceRTL` needs a reload to take effect on an already-mounted tree — show a confirm dialog explaining the app will restart, then `Updates.reloadAsync()` (dev fallback: `DevSettings.reload()`).
- Only prompt for restart when the RTL direction actually flips (ar ↔ en). ar → ar is a no-op.
- On cold start, `src/i18n/index.ts` reads the persisted language from MMKV **before** `i18n.init`; `'system'` resolves via `getLocales()` with an `ar` fallback. Delete the dead `const lng = "ar"`.

**Units / categories / expense categories**

- Selectors read from their repository via a hook (`useUnits`, `useExpenseCategories`), not from a `const` array.
- Each selector ends with an "Add new…" affordance mirroring the existing `inventory.form.addCategory` flow → inline text input → repository insert → list refreshes and the new row is auto-selected.
- Deleting a lookup row that is referenced by existing items/expenses is blocked with an explanatory alert (do not cascade — this is accounting data).

**Currency**

- All money render sites read the symbol from one hook/util, never `t('common.currency')` directly.
- `expenses.form.amount` becomes `"Expense amount ({{currency}})"` / `"قيمة المصروف ({{currency}})"`.

**Dashboard banner (item 9)**

- Replace the frozen `74%` with a real figure computed in the existing dashboard hook: `collected / totalCredit` over the current month, from the documents repository.
- `dashboard.banner.line` becomes `"Collected {{percent}}% of credit invoices"`. Percentage rendered through the existing `numerals` util (Arabic digits under `ar`).
- **Zero credit invoices this month → hide the banner entirely.** Never render `0%` or a placeholder.

**Cleanup**

- Delete `home.footer` (both files) and its render site.
- Move `inventory.demo.*` out of the locale bundle into the seed layer (`src/db/seed.ts`), or delete if unused by seed.
- Rewrite `settings.privacy.startMasked.hint` to interpolate `{{seconds}}` from the actual idle constant in code.

**States**

- Loading: settings screen renders MMKV values synchronously (no spinner); lookup lists show a skeleton row while the repository query resolves.
- Empty: a lookup table can never be empty (seeded), but the code must tolerate it — render only the "Add new…" affordance.
- Error: repository write failure → inline error under the input, previous value preserved, nothing silently dropped.
- Offline: everything is local. No network path exists.

---

## REQUIREMENTS

- Feature-first structure — settings additions under `src/features/settings/{screens,components,hooks}`; lookup-table logic in hooks + repositories, never in JSX.
- Zustand (`settings-store`) for cross-screen config; extend the existing store, do not create a second one.
- Data access only via `src/repositories/*` (Drizzle + expo-sqlite). Screens never touch the DB.
- New tables ship with **generated** Drizzle migrations (never hand-edited SQL) and a seed that preserves today's visible defaults — an existing install must look identical after upgrade.
- AR/EN parity: every key added to `en.json` is added to `ar.json`. RTL via `src/theme/rtl`.
- NativeWind + `src/theme/colors` tokens only.
- Reuse `src/components/ui/*` (settings rows, toggle, text input, bottom sheet).
- Preserve offline-first invariants; **WAC costing is untouched** — no change to cost derivation.

---

## UI GUIDELINES

- One component per file. Suggested new components: `BusinessProfileSection`, `LanguageSection`, `CurrencyPicker`, `LookupListEditor` (generic — reused by units and expense categories), `AddLookupRow`.
- `SettingsScreen` only composes sections and wires the store. No `renderX()` helpers, no inline JSX factories.
- New sections follow the exact visual rhythm of the existing `stock` / `privacy` / `data` sections — same header, row, and hint typography.
- The restart-on-RTL-flip dialog uses the existing alert/confirm component, not `Alert.alert` directly, if one exists.

---

## ARCHITECTURE GUIDELINES

- **Single source of truth per value.** Kill all three copies of the expense-category list (`data.ts:17`, `AddExpenseSheet.tsx:10`, locale keys) — the DB table is the source; locale keys survive only as translations for seeded `i18nKey`s. Same for `UNITS` in `mappers.ts:4`.
- The `i18nKey ?? name` label rule is written **once** and imported. Do not copy it into each feature's presenter.
- Currency symbol resolution is one util + one hook. Grep for `t('common.currency')` afterwards — zero hits should remain outside that util.
- `src/i18n/index.ts` must read persisted language before `init`. The current dead `deviceLang` variable and the `const lng = "ar"` override both go away.
- No locale key may contain a number, a currency symbol, a business name, or a statistic. If a string needs one, it takes an interpolation placeholder.

---

## ACCEPTANCE CRITERIA

1. `grep -nE '"(EGP|ج\.م)"|74|Step 1|Main Store|المحل الرئيسي|Main Warehouse' src/i18n/locales/*.json` returns **no hits**.
2. `grep -rn "t('common.currency')" src` returns hits only inside the currency util.
3. A fresh install renders exactly as it does today — same store name, same currency, same 7 categories, same 2 units, same 5 expense categories (seeded, translated).
4. Changing the business name in Settings updates the home header without an app restart.
5. Switching language ar → en flips RTL correctly after the prompted reload, and the choice survives a cold start.
6. A user-created category / unit / expense category appears in its selector, is selectable on a document, and renders its literal name (not a missing-key string) in **both** languages.
7. The dashboard credit banner shows a figure derived from real documents, in Arabic digits under `ar`, and is **hidden** when there are no credit invoices this month.
8. `ar.json` and `en.json` have identical key trees (a parity check passes).
9. Existing tests pass — in particular `document-repository.test.ts`, `item-repository.test.ts`, `money.test.ts`, `stock.test.ts`. WAC behavior is unchanged.
10. Deleting a lookup row still referenced by an item or expense is blocked with a clear message; no orphaned foreign keys.
