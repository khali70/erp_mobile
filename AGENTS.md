# Architecture & Conventions — Single-User Inventory App

## Product premise (load-bearing — read first)

**Single-user, offline-first. Local SQLite is the source of truth. No backend in v1.**
The phone *is* the database. Cloud sync is a future, optional module — everything marked "future" lives in the Appendix and is NOT current law. There is no server, no login server, no realtime peer, no multi-tenant concerns. Every rule below is filtered through: *one shopkeeper, one phone, counting stock, often offline.*

Two hills to die on: **speed of data entry** and **never lose data**.

## Core principles

- **Modularity over cleverness.** Small files, single responsibility, replaceable.
- **Local-first.** Writes hit local SQLite synchronously and always succeed. No spinner on the hot path. The app must feel identical in airplane mode.
- **Feature isolation.** A feature owns its screens, state, repositories, components. Features never import from sibling features. Cross-feature need → promote to shared (`src/components/`, `src/db/`, `src/store/`, `src/theme/`).
- **Layered dependencies.** `screens → hooks → repositories → db`. Lower layers never import upward.
- **Replaceable storage.** Swapping the SQLite driver, or MMKV → other KV, should touch only `src/db/` (or `src/store/persist/`).

## Folder layout

```
src/
  app/              # entry composition (providers, root navigator mount)
  navigation/       # react-navigation stacks, linking config, route types
  db/               # data layer — SQLite is the source of truth
    client.ts       # single db instance (op-sqlite / expo-sqlite + drizzle)
    schema.ts       # drizzle table definitions
    migrations/     # versioned schema migrations (run on app boot)
    types.ts        # shared domain types / DTOs
  repositories/     # domain data access — the ONLY code that reads/writes db
    productRepo.ts
    stockRepo.ts    # movement-log-centric; never mutate a quantity directly
    ...             # feature-specific repos live in features/<name>/repositories/
  services/         # cross-cutting NON-db services (scanner, backup, images, applock)
    scanner/        # barcode/QR — the only camera-scan integration
    backup/         # export/import DB + CSV/Excel, share, restore
    images/         # capture, compress, store product photos
    applock/        # PIN / biometric lock (SecureStore)
  store/            # zustand slices — UI / client state only
    ui-store.ts
    applock-store.ts
  theme/            # tokens (colors, spacing, typography), maps to NativeWind config
  components/       # shared, presentational, feature-agnostic
    ui/             # gluestack vendored primitives + async-state primitives
  hooks/            # shared hooks (useDebounce, useKeyboard, ...)
  utils/            # pure helpers (no React, no IO) — incl. money helpers
  types/            # shared TS types
  config/           # env, constants, flags (plain booleans)
  features/
    <feature>/      # e.g. catalog, stock, reports, scan
      screens/      # screen components (route targets)
      components/   # feature-local components
      hooks/        # feature-local hooks (useProductQuery, useStockForm)
      repositories/ # feature-local db access (use @/db/client)
      store/        # feature-local zustand slice (optional)
      utils/
      types.ts
      index.ts      # ONLY public surface (screens + types). Internals private.
```

Shared-only services (scanner, backup, images, applock) stay in `src/services/`. Shared repos (product, stock) stay in `src/repositories/`.

---

## Local database (`src/db/`) — the center of the app

- **Driver**: `op-sqlite` (fast, JSI) or `expo-sqlite`, with **Drizzle ORM** for typed queries + migrations. Pick one in an early decision note; op-sqlite preferred for large-list performance on low-end Android.
- `db/client.ts` is the **only** module that opens the database connection.
- **Schema** in `db/schema.ts` (Drizzle). **Migrations** in `db/migrations/`, versioned, run on boot. App must survive updates without data loss — migrations are additive and tested. Never a destructive migration without an explicit backup step first.
- **Repositories are the only db consumers.** No React, no navigation, no zustand reads in `repositories/` or `db/`. Return typed domain objects.
- **Movement-log-centric stock.** Quantity-on-hand is *derived from an immutable `stock_movements` ledger*, cached on `stock_levels` for read speed. Never silently mutate a quantity — every change writes a movement row so any number is explainable ("why is this 12?" → show history). This directly fixes the target app's "no undo / unexplained numbers" complaint.
- **Money = integer minor units.** Store prices/costs as integers (cents/fils). Never float. Helpers in `src/utils/money.ts`.
- Local reads are cheap and synchronous-feeling — no server-cache library needed as the primary data layer. Use React state / lightweight query hooks around repositories. (TanStack Query is NOT used for local data; see Appendix if a sync backend is ever added.)

## Data model (v1)

- **Product**: id, name, barcode?, sku?, category_id?, unit, pack_size?, cost_price, sale_price, reorder_threshold, reorder_qty, photo_uri?, is_active, created_at, updated_at
- **Category**: id, name, sort_order
- **StockLevel**: product_id, location_id, quantity_on_hand (derived/cached)
- **StockMovement** (immutable): id, product_id, location_id, type (`purchase_in|sale_out|adjustment|return|waste|transfer`), quantity_delta, unit_cost?|unit_price?, reference_id?, reason?, batch_id?, created_at, device_id
- **Sale** + **SaleLine**, **Purchase** + **PurchaseLine**
- Tier-2 (schema-aware now, UI later): **Supplier**, **Customer** (balance_owed), **Batch** (expiry)
- Every row carries `updated_at` + `device_id` (future sync uses last-write-wins). `location_id` present from day one so multi-location never needs a re-architecture — build the UI only when demanded.

## Barcode / QR scanning (`src/services/scanner/`)

- The single most important input method. `react-native-vision-camera` code scanner (or `expo-camera` barcode scanner).
- Only place that opens the scanner. Feature code calls `useScanner()` / `scannerService`.
- A scan resolves against the **local catalog** — must work fully offline. Scan flows: (a) find existing item, (b) start new item with code pre-filled, (c) drive stock-in/out and sale/purchase lines.
- Scanning **accelerates**, never gates. Not every good has a barcode (loose produce, bulk) — search + manual entry are always available.

## Images (`src/services/images/`)

- Product photos: capture, then `expo-image-manipulator` for resize/compress, store file on disk (`expo-file-system`), keep only the path in the DB. Display + cache via `expo-image`. Generate a thumbnail for list rows.
- Only this service touches the camera-for-photos and filesystem for images.

## Backup / restore + export (`src/services/backup/`) — the trust anchor

Existential for a local-only app: lost/broken phone must not mean a lost business.

- **Auto backup**: periodic + on significant change. Export the SQLite DB (or a JSON dump) to a file; optionally push to Google Drive / iCloud. Surface a visible **"last backed up"** status on the home screen.
- **Manual export/restore**: export via `expo-sharing`; restore via `expo-document-picker`. Restore onto a fresh phone must fully rehydrate.
- **Data export (CSV / Excel / PDF)**: stock report, low-stock list, valuation — shareable/printable. Feeds the owner's accountant; also an anti-lock-in escape hatch.
- **Never a destructive action without a backup + undo path.** Archive, don't hard-delete (`is_active=false`). This is the #1 lesson from the target app's data-loss reviews.

## State (`src/store/`)

- Zustand for **client/UI state only**: theme, UI flags, app-lock state, transient form drafts.
- Durable business data lives in **SQLite**, not zustand. Do not mirror DB rows into a global store.
- One slice per concern, `<name>-store.ts`. Export selectors alongside the store to avoid re-render storms (`useUiStore(s => s.theme)`).
- Persist only what must survive restart via `zustand/middleware/persist` with an MMKV adapter. Secrets (PIN hash / biometric flag) → SecureStore, never MMKV/AsyncStorage.

## Features (`src/features/<name>/`)

- Public surface via `index.ts` — only screens + types exported. Components, hooks, repositories stay internal.
- Feature hook pattern: `useXxxQuery` (wraps a repository read), `useXxxMutation` (wraps a repository write), `useXxxForm`.
- Screens are dumb wrappers: read hooks, render components, dispatch actions. No db access, no business logic inline.
- Cross-feature navigation via `navigation/` types — don't import sibling screens.
- **Promotion rule (single, authoritative):** default to a **shared** repo/service in `src/repositories/` or `src/services/` for anything cross-cutting (stock, product, scanner, backup). Keep it feature-local only when genuinely scoped to one feature. Promote by moving the file + updating imports in one PR. **Judge by coupling, not consumer count** — there is no "promote on Nth consumer" rule.

## Navigation (`src/navigation/`)

- React Navigation stacks declared here, route param types exported. Screens registered by feature import; navigator owns no screen logic.
- Deep linking is minimal (open to a product/screen). No auth-gated linking — there is no login server. Basic deep links only; no per-route zod apparatus required.

## App lock (`src/services/applock/`)

Realistic security for a solo app = stop someone who picks up the phone, not OAuth.

- Optional PIN + biometric (`expo-local-authentication`). PIN hash / enabled flag in **SecureStore** (Keychain / Keystore).
- Lock on background + configurable timeout. No tokens, no refresh flow, no server.

## Theme & styling

- Tokens (colors, spacing, radii, typography) in `src/theme/tokens.ts` + mirrored in `tailwind.config.js`. Components consume via Tailwind classes or `useTheme()`.
- No hex literals in components. No `style={{ color: '#...' }}`.

### NativeWind-only styling (review-blocking)

**All component styles use NativeWind `className` strings. `StyleSheet` is banned in app code.**

- No `StyleSheet.create({...})` in `src/features/**`, `src/screens/**`, `src/components/**` (excluding vendored `src/components/ui/`).
- No `import { StyleSheet } from "react-native"` in app code. Use `className="absolute inset-0"` instead of `absoluteFill`.
- Color literals live only in `src/theme/colors.ts` (re-exported into `tailwind.config.js`), readable from JS **only** for props that can't take `className`: SVG `color`/`fill`/`stroke`, `placeholderTextColor`, `selectionColor`, `StatusBar backgroundColor`, `ActivityIndicator color`, third-party object-`style` props.
- Inline `style={{}}` allowed **only** where NativeWind can't express it: RN `shadow*`+`elevation`, `Animated.Value` interpolations, per-instance dynamic colors from state maps. Static parts move to `className`; only the dynamic bit stays inline.
- New color → add to `tailwind.config.js` + `src/theme/colors.ts`. No `bg-[#hex]` arbitrary literals except one-off rgba overlays.
- Dynamic classes via template literals; `clsx` only when a component has >3 toggles.
- 3rd-party primitives shipping their own `StyleSheet` (gluestack, react-navigation) are fine — the rule is for **app** code.

CI: ESLint `no-restricted-imports` blocks `StyleSheet` from `react-native` outside `src/components/ui/`.

## Config & env

- Read config directly from `src/config/env.ts` (zod-validated at boot; app refuses to boot on invalid config). No `process.env.X` outside `src/config/env.ts`.
- No `env` params threaded through repositories/services — import what you need at point of use.
- New config var → add to `EnvConfig` + `loadEnv()` in `src/config/env.ts`, update `.env.example`.
- Feature flags: a plain `src/config/flags.ts` with boolean constants. No expiry/owner/lifecycle machinery — one user, no rollouts or A/B.

## Error / loading / empty UX primitives

Every async branch renders one of these. No bare `if (isLoading) return null`. Lives in `src/components/ui/`.

- `<Skeleton variant="text|card|list|avatar" />`
- `<ErrorState title message onRetry />`
- `<EmptyState icon title message action />`
- `<LoadingOverlay />`

## Errors & observability

- Root `ErrorBoundary` in `src/app/`, per-feature boundaries on heavy screens.
- Crash reporting only (Sentry or equivalent), init in `src/app/`, with a single on/off toggle in settings. No analytics event pipeline, no PII redaction module, no GDPR opt-out machinery — one owner, own device, no third-party data subjects.
- Never log DB contents or secrets in production. Dev-only via `if (__DEV__)`.

## Path aliases

- `tsconfig.json` paths + `babel-plugin-module-resolver`: `@/*`, `@features/*`, `@db/*`, `@repositories/*`, `@services/*`, `@store/*`, `@theme/*`, `@components/*`, `@hooks/*`, `@utils/*`, `@config/*`.
- Forbid relative imports crossing more than one `..`.

## Performance

- Hermes on.
- `FlashList` over `FlatList` for any list > ~20 items (catalogs get long).
- Memo zustand selectors; avoid returning new objects from selectors.
- `useMemo` / `React.memo` where the profiler shows wins, not preemptively.
- Reanimated worklets for gesture / animation hot paths.
- Hot path budget: find item → change qty → confirm in ≤3 taps, no network, no spinner.

## Testing

- Jest + React Native Testing Library for hooks + components.
- **Repository layer** unit-tested against an in-memory / temp SQLite instance (not mocks — real driver, real SQL).
- Maestro for e2e.
- Colocated: `foo.ts` + `foo.test.ts`.
- **Coverage philosophy**: no line-% gate. Require critical paths covered instead:
  - Every repo public method: happy path + one failure mode.
  - Every mutation hook: write + the derived-quantity/movement-log invariant.
  - Every screen golden path: render + primary interaction.
  - **Backup/restore, stock movement math, migrations: always covered, no exceptions.**
  - Reviewer asks "what behavior does this test pin?" — no answer → delete it.

## File naming

- Components: `PascalCase.tsx`. Hooks: `useThing.ts`. Repositories: `<domain>Repo.ts`. Services: `<domain>Service.ts`. Store slices: `<name>-store.ts`. Utils: `kebab-case.ts`.
- No barrel `index.ts` aggregators inside `src/` — only feature public surface. Barrels hurt Metro cold start + tree-shaking.

## Hard rules (review-blocking)

- No direct db access (`db/client`) outside `src/db/` and `src/repositories/` (+ feature repos).
- No `AsyncStorage` / `SecureStore` / `MMKV` outside `store/persist/` or `services/`.
- No feature → feature imports.
- No `process.env.*` outside `config/`.
- No `React.FC`. Function components only. `ref` as prop (React 19).
- No `StyleSheet.create` / `absoluteFill` in app code — NativeWind `className` only.
- No floats for money — integer minor units only.
- No destructive delete — archive (`is_active=false`); no destructive migration without a backup step.
- No new top-level `src/<folder>` without justification (a one-line note in the PR — no formal ADR process for a solo dev).

## Platform splits

- `Foo.ios.tsx` / `Foo.android.tsx` only when divergence is large. Small `Platform.OS` branches inline OK.
- Safe area: use `useSafeAreaInsets()` from `react-native-safe-area-context` (composable, correct on notches). Prefer it over the `SafeAreaView` component so inset handling is explicit; the raw RN `SafeAreaView` is iOS-only and insufficient.

## CI enforcement (right-sized for solo)

- **Pre-commit** (lefthook/husky): `tsc --noEmit`, `eslint`, `prettier --check`. This is the layer that matters.
- **ESLint rules**: block db `client` import outside `db/`+`repositories/`; block storage libs outside `store/persist/`+`services/`; block sibling `features/*` imports; ban `process.env.*` outside `config/`; ban `React.FC`; ban `StyleSheet` from `react-native` outside `src/components/ui/`; a11y on touchables.
- **CI pipeline**: pre-commit checks + unit tests + `expo-doctor`.
- Dropped (team/backend ceremony, not solo): danger-js ADR gate, OpenAPI drift check, bundle-size budget, "new service must ship a test or PR fails" bot.

## Accessibility

- Every touchable: `accessibilityLabel` + `accessibilityRole` (lint-enforced). Min tap target 44x44.
- Dynamic Type on, capped `maxFontSizeMultiplier={1.3}`.
- RTL: logical props (`start`/`end`, `marginStart`, `paddingEnd`); lint bans `left`/`right` in styles.
- Token colors meet WCAG AA.

## React 19 compatibility

- Expo SDK ships React 19. `ref` as prop works in app code.
- `forwardRef` permitted, not banned — vendored libs still ship it. Lint fires only on new app code in `src/features/**` + `src/components/**`, not `src/components/ui/` or `node_modules`.
- Migration of existing `forwardRef` is opportunistic. Revisit each SDK bump.

## Adding a feature — checklist

1. `src/features/<name>/` with `screens/`, optional `components/`, `hooks/`, `repositories/`, `store/`, `types.ts`, `index.ts`.
2. New data access: add to a feature repo, or a shared repo in `src/repositories/` if cross-cutting (judge by coupling, not count — see Promotion rule).
3. New schema: add table/migration in `src/db/`. Migration is additive + tested.
4. New global UI state: justify why not local/DB. Add slice in `src/store/`.
5. Register screens in `src/navigation/`. Public exports via `features/<name>/index.ts`.

---

## i18n (defer)

Legitimate if selling in multiple languages, but heavy for MVP. Ship in one language first. When needed: `i18next` + `react-i18next` + `expo-localization`, `en.json` source-of-truth, keys `feature.screen.element`, `Intl` for date/number. **Do not enable the no-literal-string lint rule on day one** — it slows every screen.

---

## Appendix — FUTURE ONLY (not current law; only if a cloud-sync backend is ever added)

These are deliberately deferred. They describe a world with a server. Do **not** build them for v1. Kept here so the decision is explicit, not forgotten.

- **Backend + API client**: single `fetch`/`axios` instance, error normalization. Only relevant once a sync server exists.
- **Sync engine**: reconcile local SQLite ↔ server. Last-write-wins per `device_id` (single user makes conflicts rare). Optimistic local writes already always succeed; sync is a background push/pull, not a mutation gate.
- **OpenAPI/codegen + runtime validation**: only if the backend exposes a schema. Note: zod-validating large lists on low-end Android is costly — sample, don't validate-all.
- **TanStack Query**: as a *server-cache* layer for synced/remote data — never as the local-data source of truth.
- **Realtime (WebSocket/SSE)**: not applicable to a single-user app — there is no second party to sync with in real time. Only revisit for a genuine multi-device live-collab feature.
- **Multi-user + roles/permissions, deep-link auth, EAS-Secrets/OAuth**: belong to a hypothetical team edition, not this product.
- **Analytics event registry + PII redaction + GDPR/CCPA**: only if third-party user data is ever processed.

**Bottom line:** v1 is a fast, offline, trustworthy local catalog with a low-stock brain, scanning, photos, money-accurate reports, and bulletproof backup. Everything in this appendix is a different, later product.
