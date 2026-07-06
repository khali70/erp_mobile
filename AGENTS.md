## Core principles

- **Modularity over cleverness.** Small files, single responsibility, replaceable.
- **Feature isolation.** A feature owns its screens, state, services, components. Features never import from sibling features. Cross-feature need → promote to shared (`src/components/`, `src/services/`, `src/store/`, `src/theme/`).
- **Layered dependencies.** `screens → hooks → services → api client`. Lower layers never import upward.
- **Replaceable storage / transport.** Swapping fetch → axios, AsyncStorage → MMKV, should touch only `src/services/` (or `src/store/persist/`).

## Folder layout

```
src/
  app/              # entry composition (providers, root navigator mount)
  navigation/       # react-navigation stacks, linking config, route types
  services/         # data layer — API client + cross-cutting domain services only
    api/
      client.ts     # single fetch/axios instance, interceptors (auth, refresh, error)
      types.ts      # shared transport types (ApiError, ApiResponse<T>)
    auth/           # authService.ts — used by every feature, lives here
    ...             # feature-specific services live in features/<name>/services/
  store/            # zustand global slices (client state only)
    auth-store.ts
    ui-store.ts
  theme/            # tokens (colors, spacing, typography), maps to NativeWind config
  components/       # shared, presentational, feature-agnostic
    ui/             # gluestack vendored primitives
  hooks/            # shared hooks (useDebounce, useKeyboard, ...)
  utils/            # pure helpers (no React, no IO)
  types/            # shared TS types / DTOs
  config/           # env, constants, feature flags
  features/
    <feature>/
      screens/      # screen components (route targets)
      components/   # feature-local components
      hooks/        # feature-local hooks (useXxxQuery, useXxxForm)
      services/     # feature-local domain services (e.g. chatService.ts) — use @/services/api/client
      store/        # feature-local zustand slice (optional)
      utils/
      types.ts
      index.ts      # ONLY public surface (screens + types). Internals stay private.

  e.g. features/chat/services/chatService.ts (NOT src/services/chat/).
  Shared-only services (auth, device, telemetry) stay in src/services/.
```

## Data layer (`src/services/`)

- `services/api/client.ts` is the **only** module that calls `fetch`/`axios` directly.
  - Auth header injection, 401 refresh-token retry, error normalization, request id, timeout.
  - Exports typed methods: `get<T>`, `post<T, B>`, `put`, `del`.
- Domain services consume `api/client`. Return typed domain objects, not raw responses.
  - **Default: shared service in `src/services/<domain>/`** for anything touching `api/client`, auth state, tokens, or cross-cutting concerns. Avoids the churn of promote-on-second-consumer.
  - **Feature-local service only when** the service is genuinely scoped to one feature's data model and has no auth/token interaction beyond what `api/client` injects (e.g. `features/onboarding/services/stepTrackerService.ts`). When in doubt → shared.
  - **Promotion is allowed but discouraged.** If a feature-local service becomes shared, move file + update imports in one PR. No "promote on Nth consumer" rule — judge by coupling, not count.
- No React imports in `services/`. No navigation, no zustand reads. Pure functions / classes.
- Server-state caching lives in TanStack Query hooks (in `features/*/hooks/` or `src/hooks/`), **not** in zustand.

## State (`src/store/`)

- Zustand for **client state shared across screens**: auth user, theme, UI flags, voice mode, drafts.
- Do **not** dump API responses in zustand. Server cache = TanStack Query.
- One slice per concern, `<name>-store.ts`. Selectors exported alongside the store to avoid re-render storms (`useAuthStore(s => s.user)`).
- Persist only what must survive restart. Use `zustand/middleware/persist` with MMKV/SecureStore adapter. Tokens → SecureStore. Never AsyncStorage for secrets.

## Features (`src/features/<name>/`)

- Public surface via `index.ts` — only screens + types exported. Components, hooks, services stay internal.
- Feature hook pattern: `useXxxQuery` (TanStack Query call wrapping a service), `useXxxMutation`, `useXxxForm`.
- Screens are dumb wrappers: read hooks, render components, dispatch actions. No fetch, no business logic inline.
- Cross-feature navigation: dispatch via `navigation/` types, don't import sibling screens.

## Navigation (`src/navigation/`)

- React Navigation stacks declared here, route param types exported.
- Deep linking config centralized.
- Screens registered by feature import. Navigator does not own screen logic.

## Theme & styling

- Tokens (colors, spacing, radii, typography) in `src/theme/tokens.ts` + mirrored in `tailwind.config.js` under `donna.*`.
- NativeWind / Tailwind config consumes tokens. Components consume tokens via Tailwind classes or `useTheme()`.
- No hex literals in components. No `style={{ color: '#...' }}`.

### NativeWind-only styling (review-blocking)

**All component styles use NativeWind `className` strings. `StyleSheet` is banned in app code.**

- No `StyleSheet.create({...})` in `src/features/**`, `src/screens/**`, `src/components/**` (excluding `src/components/ui/` vendored gluestack).
- No `import { StyleSheet } from "react-native"` in app code.
- No `StyleSheet.absoluteFill` / `absoluteFillObject` — use `className="absolute inset-0"`.
- Color literals (`Colors.X`, hex strings) live only in `src/theme/colors.ts` (re-exported into `tailwind.config.js`) and remain readable from JS **only** for props that can't take `className`:
  - SVG `color`/`fill`/`stroke` props
  - `placeholderTextColor`, `selectionColor`
  - `StatusBar backgroundColor`
  - `ActivityIndicator color`
  - Third-party libs that take a style **object** prop (e.g. `react-native-markdown-display`'s `style` dict)
- `style={{}}` inline is allowed **only** for cases NativeWind cannot express:
  - RN `shadow*` props + `elevation` (NW v4 has no equivalent)
  - `Animated.Value` interpolations (`transform`, `opacity` from `useNativeDriver`)
  - Per-instance dynamic colors from state maps (e.g. `STATE_COLOR[state]`)
- Static class parts must move out of inline `style` onto `className`; only the dynamic/animated bit stays inline.
- Adding a new color → add it to `tailwind.config.js` `donna.*` namespace + `src/theme/colors.ts`. Never `bg-[#hex]` arbitrary literals except for one-off rgba alpha overlays.
- Dynamic class composition: use template literals (`` className={`base ${cond ? "a" : "b"}`} ``); no `clsx` needed unless a component has >3 toggles.
- New 3rd-party UI primitive that ships its own `StyleSheet` (gluestack, react-navigation internals) is fine — the rule applies to **app** code.

CI: ESLint `no-restricted-imports` blocks `StyleSheet` from `react-native` outside `src/components/ui/`. Lint failure → PR blocked.

## Config & env

Read env directly from `src/config/env.ts`. Do **not** thread env values through constructor params, function args, or service factories.

- Import the loaded config from `src/config/env.ts` at the point of use.
- No `process.env.X` reads outside `src/config/env.ts`.
- No `env: EnvConfig` (or subset) parameters on services, repos, tool builders, or route handlers — they import what they need.
- New env var → add to `EnvConfig` + `loadEnv()` in `src/config/env.ts`, then import directly where used. Also update `.env.example` (see §6).
- Tests override config by stubbing the `env.ts` export, not by passing alternate env objects.


## API request rules

- Every request goes through `services/api/client`.
- Errors throw `ApiError` (status, code, message, requestId). UI handles via try/catch in hook or ErrorBoundary.
- Auth refresh handled inside interceptor — features never call refresh manually.
- Pagination, retries, deduping → TanStack Query, not custom code.

## Security

- Access token + refresh token → `expo-secure-store` (Keychain / Keystore).
- MMKV for non-secret hot KV (drafts, preferences).
- Never log tokens. Redact in error reporting.

## Errors & observability

- Root `ErrorBoundary` in `src/app/`, per-feature boundaries on heavy screens.
- Sentry (or equivalent) init in `src/app/`. Tag with userId from auth-store after login.
- All `services/api/client` failures emit a breadcrumb.

## Path aliases

- `tsconfig.json` paths + `babel-plugin-module-resolver`: `@/*`, `@features/*`, `@services/*`, `@store/*`, `@theme/*`, `@components/*`, `@hooks/*`, `@utils/*`, `@config/*`.
- Forbid relative imports crossing more than one `..`.

## Performance

- Hermes on.
- `FlashList` over `FlatList` for any list > ~20 items.
- Memo zustand selectors. Avoid returning new objects from selectors.
- `useMemo` / `React.memo` where profiler shows wins, not preemptively.
- Reanimated worklets for gesture / animation hot paths.

## Testing

- Jest + React Native Testing Library for hooks + components.
- Service layer unit-tested with mocked api client.
- Maestro for e2e (lighter than Detox).
- Test files colocated: `foo.ts` + `foo.test.ts`.

## File naming

- Components: `PascalCase.tsx`.
- Hooks: `useThing.ts`.
- Services: `<domain>Service.ts`.
- Store slices: `<name>-store.ts`.
- Utils: `kebab-case.ts`.
- No barrel `index.ts` aggregators inside `src/` — only feature public surface. Barrels hurt Metro cold start and tree-shaking.

## Hard rules (review-blocking)

- No `fetch` / `axios` outside `services/api/`.
- No `AsyncStorage` / `SecureStore` / `MMKV` outside `store/persist/` or `services/`.
- No feature → feature imports.
- No `process.env.*` outside `config/`.
- No `React.FC`. Function components only. `ref` as prop (React 19).
- No new top-level `src/<folder>` without architectural justification.
- No `StyleSheet.create` / `StyleSheet.absoluteFill` in app code. NativeWind `className` only (see §Theme & styling).

## Platform splits

- `Foo.ios.tsx` / `Foo.android.tsx` only when divergence is large. Small `Platform.OS` branches inline OK.

## CI enforcement (review-blocking)

Hard rules are enforced by tooling, not folklore. CI fails the PR on violation.

- **ESLint custom rules**:
  - `no-restricted-imports`: block `fetch`/`axios` outside `src/services/api/`.
  - `no-restricted-imports`: block `@react-native-async-storage/async-storage`, `expo-secure-store`, `react-native-mmkv` outside `src/store/persist/` and `src/services/`.
  - `no-restricted-imports`: block `features/*/` importing from sibling `features/*/`.
  - `no-restricted-syntax`: ban `process.env.*` outside `src/config/`.
  - `no-restricted-syntax`: ban `React.FC`.
  - `no-restricted-imports`: ban `SafeAreaView` from `react-native-safe-area-context`.
  - `no-restricted-imports`: ban `StyleSheet` named import from `react-native` outside `src/components/ui/`.
  - `eslint-plugin-react-native-a11y`: enforce a11y on touchables.
- **danger-js** PR bot: fail PR if hard rule violated, if new `src/<folder>` added without ADR link, if new service ships without colocated test.
- **Pre-commit** (lefthook or husky): `tsc --noEmit`, `eslint`, `prettier --check`.
- **CI pipeline**: same as pre-commit + unit tests + `pnpm gen:api` drift check + bundle size check.

## TanStack Query conventions

- **Single client** in `src/services/query/queryClient.ts` with project defaults:
  - `staleTime: 30_000`
  - `gcTime: 5 * 60_000`
  - `retry`: only on `ApiError` with `status >= 500`, max 2.
  - `refetchOnWindowFocus: false`, `refetchOnReconnect: true`.
  - Mutations: `retry: false`.
- **queryKey factory per feature**: `features/<name>/hooks/<name>-keys.ts`. No inline string arrays in `useQuery` calls.
  ```ts
  export const chatKeys = {
    all: ['chat'] as const,
    threads: () => [...chatKeys.all, 'threads'] as const,
    thread: (id: string) => [...chatKeys.all, 'thread', id] as const,
    messages: (threadId: string) => [...chatKeys.thread(threadId), 'messages'] as const,
  };
  ```
- **Invalidation matrix**: each feature documents which mutation invalidates which keys in `features/<name>/hooks/README.md` (or top of mutation file).
- **Persist cache**: TanStack `persistQueryClient` with MMKV adapter. Survive cold start.

## Offline + mutation queue

- **Network state**: `src/store/network-store.ts` subscribes to `@react-native-community/netinfo`. Exposes `isOnline`, `type`, `isInternetReachable`.
- **Client behavior**: `services/api/client.ts` throws `OfflineError` (subclass of `ApiError`) when offline. Hooks branch on it.
- **Critical mutations** (send message, save draft, like, etc.) use optimistic update via `onMutate` + rollback in `onError`. Use TanStack `onlineManager` so mutations pause + replay on reconnect.
- **UI rule**: every screen renders the offline banner from `network-store`. Banner component lives in `src/components/ui/OfflineBanner.tsx`.
- **Forbidden**: silent failure when offline. User must see state.

## Realtime (WebSocket / SSE)

Chat, presence, typing indicators, live notifications. Treat realtime as a peer transport to REST, not a free-for-all.

- **Single transport module**: `src/services/realtime/client.ts`. Only place that opens a `WebSocket` or `EventSource` connection. Feature code never instantiates either directly.
- **Choice**: SSE for server→client only (notifications, live counters). WebSocket for bidirectional (chat, collab). Don't mix in one feature.
- **URL + auth**: token from `auth-store` injected as `Sec-WebSocket-Protocol` subprotocol or `?access_token=` query (per backend contract). On 401 frame → run refresh flow → reconnect. Never embed refresh token.
- **Connection lifecycle**:
  - Connect on first subscriber, disconnect when last subscriber unmounts + 30s idle grace.
  - Tie to `AppState`: disconnect on `background`, reconnect on `active`.
  - Tie to `network-store`: drop socket on offline, reconnect on online.
- **Reconnect**: exponential backoff with jitter, capped at 30s. Cap retries → after N (default 8) emit `RealtimeError` and surface UI banner. Never tight-loop.
- **Message envelope**: every frame is `{ id, type, ts, payload }`. `id` enables ack + dedupe. Validate `payload` per `type` with zod schema from `src/services/realtime/events.ts` (same codegen path as REST when backend exposes AsyncAPI; otherwise hand-written zod). Drop + Sentry on schema mismatch.
- **Backpressure**: bounded inbound queue per channel (default 500 frames). Overflow = drop oldest + log. Never let an unbounded buffer eat memory on a slow render.
- **Integration with TanStack Query**: realtime events do **not** bypass cache. On event, call `queryClient.setQueryData(key, updater)` or `invalidateQueries(key)`. Components keep reading from Query — single source of truth.
- **Optimistic send**: outbound message → optimistic insert via Query → send frame → on `ack` frame, mark delivered; on timeout (default 10s), mark failed + allow retry. Pending sends queue while offline, flush on reconnect (same model as mutation queue).
- **Heartbeat**: client ping every 20s if no inbound frame. Missed pong twice → force reconnect.
- **No business logic in transport**. `realtime/client.ts` only routes envelopes. Feature subscribes via `useRealtimeChannel('chat:threadId', handler)` hook.
- **Testing**: mock `realtime/client` with an in-memory event bus. E2E uses a Maestro-friendly local WS echo server.
- **Forbidden**:
  - Direct `new WebSocket(...)` / `new EventSource(...)` outside `services/realtime/`.
  - Storing realtime payloads in zustand (use Query cache).
  - Long-lived sockets while app is backgrounded (battery + iOS will kill anyway).
  - Trusting frame order — always sort by `ts` server-stamped, not arrival.

## API schema source of truth

- **Backend exposes OpenAPI 3.1** at `/openapi.json`. Mobile treats it as contract.
- **Codegen**: `pnpm gen:api` runs `openapi-typescript` → `src/services/api/schema.ts` (types) + `openapi-zod-client` → `src/services/api/schemas.zod.ts` (runtime).
- **Runtime validation**:
  - **Dev / staging**: validate every response. Fail closed → throw `ApiError` with `code: 'SCHEMA_MISMATCH'`. Surfaces drift loudly during development.
  - **Production**: sample at low rate (default 1–5%, configurable in `src/config/flags.ts`). On mismatch in prod, log to Sentry with `code: 'SCHEMA_MISMATCH'` and **return the parsed payload anyway** — never block UX on validation cost. Big payloads (chat history, paginated lists > 100 items) always skip validation in prod; mark schema with `skipValidationInProd: true`.
  - Measure cost before changing defaults. Zod parse of a 500-item list on a low-end Android = real frames dropped.
- **CI gate**: regenerate on PR, diff against committed output. Fail if drift.
- **Forbidden**: hand-written DTOs that mirror backend shapes. Derive from schema.

## Error / loading UX primitives

Every async branch renders one of these. No bare `if (isLoading) return null`. Lives in `src/components/ui/`.

- `<Skeleton variant="text | card | list | avatar" />`
- `<ErrorState title message onRetry />`
- `<EmptyState icon title message action />`
- `<LoadingOverlay />`
- `<OfflineBanner />`

Storybook (or RN equivalent) entry per primitive. Designer signs off once, reused everywhere.

## Accessibility

- Every touchable: `accessibilityLabel` + `accessibilityRole` required. Lint-enforced.
- Min tap target: 44x44.
- Dynamic Type: `allowFontScaling` on, capped at `maxFontSizeMultiplier={1.3}`.
- RTL: use logical props (`start`/`end`, `marginStart`, `paddingEnd`). Lint bans `left`/`right` in styles.
- Color contrast: tokens in `theme/tokens.ts` meet WCAG AA. No ad-hoc colors.
- Screen reader smoke test in Maestro e2e for critical flows.

## i18n

- Stack: `i18next` + `react-i18next` + `expo-localization`.
- Files: `src/i18n/locales/<lang>.json`. Source-of-truth = `en.json`. Others derived (Crowdin/Lokalise or manual).
- **Forbidden**: string literals in JSX `<Text>` children. ESLint rule enforces `t('key')`.
- Key naming: `feature.screen.element` (e.g. `chat.composer.placeholder`).
- Pluralization + interpolation via i18next, never string concat.
- Date / number formatting via `Intl` with locale from `expo-localization`.

## React 19 compatibility check

- Expo SDK 54 ships React 19.1 stable. `ref` as prop works in app code.
- **`forwardRef` is permitted, not banned.** Vendored libs (gluestack, react-navigation internals, third-party UI) still ship `forwardRef` and will for some time. Lint rule only fires on **new app code in `src/features/**` and `src/components/**`**, not on `src/components/ui/` (vendored gluestack primitives) and not on `node_modules` re-exports.
- Migration of existing `forwardRef` → ref-as-prop is opportunistic, not a campaign. Touch when editing the file for another reason.
- Revisit on each Expo SDK bump.

## Analytics + PII redaction

- **Wrapper**: `src/services/analytics/analytics.ts` abstracts vendor (Segment / PostHog / Amplitude). Swap = one file.
- **Typed event registry**: `src/services/analytics/events.ts` declares every event + payload type. `track()` only accepts registered events. No string-typed calls.
- **Event naming**: `feature_object_action` snake_case. Examples: `chat_message_sent`, `auth_login_succeeded`, `settings_theme_changed`.
- **PII redaction**: `src/services/observability/redact.ts` strips email, phone, token, full name, address, IP, geo. Applied in Sentry `beforeSend` and analytics middleware.
- **Logging rule**: never log request/response bodies in production. Dev-only via `if (__DEV__)`.
- **GDPR/CCPA**: user opt-out toggle in settings. Honor `DoNotTrack`-equivalent flag → suppress analytics, keep crash reporting (legitimate interest).

## Architecture Decision Records (ADR)

- New top-level `src/<folder>`, new native module, new top-level dependency category (state lib, query lib, nav lib), or any deviation from these rules → requires an ADR PR first.
- Location: `docs/adr/NNNN-short-title.md`. Template: Context, Decision, Consequences, Alternatives considered.
- Numbered sequentially. Never delete — supersede with new ADR referencing the old.

## Feature flag lifecycle

- Every flag in `src/config/flags.ts` declares `{ key, default, expiresAt: 'YYYY-MM-DD', owner }`.
- CI warns at 30 days before `expiresAt`, fails at 60 days past.
- Sunset path: remove flag → delete dead branch → remove from `flags.ts` in one PR.
- No nested flags. No flag-of-flag.

## Bundle + native module policy

- **Bundle budget**: `size-limit` (or equivalent) in CI. Fail if JS bundle exceeds agreed budget (set per platform, revisit quarterly).
- **`expo-doctor`** clean on every PR.
- **New native module**: ADR + EAS build profile check + verify Expo Go vs dev client impact. Default = dev client, not Expo Go.
- **Dependency add**: justify in PR description. Prefer Expo SDK module over community module when both exist.

## Deep linking + auth

- `src/navigation/linking.ts` route table marks every route with `requiresAuth: boolean`.
- Unauthenticated deep link to `requiresAuth: true` route → store intent in `auth-store.pendingIntent` → redirect to login → resume original route on success.
- Universal Links + Android App Links configured via `app.config.ts`. Verified domains only.
- **Per-route param validation via zod**, not prose. Each route declares a schema in `src/navigation/linking.ts`:
  ```ts
  export const routeSchemas = {
    ChatThread: z.object({ threadId: z.string().uuid() }).strict(),
    Profile:    z.object({ userId: z.string().uuid(), tab: z.enum(['posts','about']).optional() }).strict(),
  } satisfies Record<RouteName, ZodSchema>;
  ```
  - `.strict()` rejects unknown keys → no smuggled params.
  - Linking layer parses URL → validates against `routeSchemas[name]` → on failure, route to a safe fallback (home or 404 screen), log to Sentry.
  - CI check: every route registered in the navigator must have a matching `routeSchemas` entry (type-level exhaustiveness via `satisfies Record<RouteName, ...>`).

## Secrets + env

- Runtime secrets: **EAS Secrets** only. Injected at build time into `app.config.ts` extras.
- `.env` files: never committed. `.env.example` mandatory and kept in sync.
- All `process.env.*` reads centralized in `src/config/env.ts` with zod validation at startup. App refuses to boot on invalid env.

## Testing additions

- **Coverage philosophy**: no line-percentage gate. Coverage targets reward bad tests (asserting nothing, just hitting lines). Require **critical paths covered** instead:
  - Every service public method: happy path + one failure mode.
  - Every mutation hook: optimistic update + rollback.
  - Every screen golden path: render + primary interaction.
  - Auth, offline reconnect, payment, data deletion: always covered, no exceptions.
  - PR reviewer asks "what behavior is this test pinning?" — if no answer, delete the test.
- **Service tests**: mock `api/client` with **MSW** (Mock Service Worker) using the same OpenAPI-derived schemas. No hand-rolled fetch mocks.
- **Contract tests**: on schema regen, snapshot of generated types is committed. Diff visible in PR.
- **E2E**: Maestro flows for auth, primary feature happy path, offline reconnect.

## Adding a feature — checklist

1. `src/features/<name>/` with `screens/`, optional `components/`, `hooks/`, `services/`, `store/`, `types.ts`, `index.ts`.
2. If new API endpoint: add method to `features/<name>/services/<name>Service.ts`. Promote to `src/services/<domain>/` only when a second feature needs it.
3. If new global state: justify why not server state. Add slice in `src/store/`.
4. Register screens in `src/navigation/`.
5. Public exports via `features/<name>/index.ts`.
6. Update aliases if new top-level shared folder added.
