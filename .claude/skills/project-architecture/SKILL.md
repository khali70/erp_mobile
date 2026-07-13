---
name: project-architecture
description: Feature-first structure and file-placement rules for this React Native/Expo repo (src/features/<feature>/{screens,components,hooks}, shared src/components/ui, repositories, db). Use whenever creating new files, screens, components, or hooks, or deciding where code belongs.
---

# Skill: Project Architecture

## Purpose

Ensure every generated feature follows the existing project structure.

## Project Structure

```
src/
├── app/            # app entry / providers
├── components/
│   └── ui/         # shared, cross-feature components (BottomSheet, ScreenHeader, SearchBar, ...)
├── config/
├── db/             # Drizzle schema + migrations + testing
│   ├── migrations/
│   └── testing/
├── features/
│   └── <feature>/
│       ├── screens/       # one screen per file — compose + navigate + wire state
│       ├── components/     # small presentational components, one per file
│       ├── hooks/          # business/data logic (useXList / useXDetail / useXForm)
│       ├── utils/          # pure helpers
│       └── types.ts        # feature-local types
├── i18n/
│   └── locales/    # ar.json, en.json
├── navigation/     # RootNavigator + RootStackParamList
├── repositories/   # data-access LAYER — repo interface + factory impl; ONLY place that touches DB/API. Backend injected, swappable (local SQLite → remote/multi-tenant)
├── services/       # cross-cutting services (e.g. backup)
├── store/          # Zustand stores (settings-store, ui-store, mmkv)
├── theme/          # colors, rtl helpers
└── utils/          # shared helpers (money, numerals, ...)
```

Existing features to mirror: `documents`, `inventory`, `parties`, `cashbook`, `expenses`, `reports`, `scan`, `settings`.

## Layered architecture (SOLID / DI)

Data access is an isolated, swappable layer. Higher layers depend on the **repository interface**, never a concrete DB/API impl — so local SQLite can be replaced by a remote/multi-tenant backend with zero changes above the repo. See the `data-layer` skill for full rules.

```
screens/components → hooks → repository INTERFACE (port)
                                     ↑ implemented by
                            repository IMPL (SQLite today · RemoteHttp tomorrow)
                                     ↑ backend injected via factory
                            @/db/client bound ONLY in *-repository.client.ts (composition root)
```

- Dependency Inversion: consumers bind to the interface; backend handle (`DocDb`/`apiClient`) injected via `createXRepository(dataSource)` factory — never imported inside the impl or consumers.
- Only `*-repository.client.ts` imports `@/db/client`.
- No raw rows leak — repos return clean typed domain shapes.

## Core Rules

- **Data access only via repositories** (`src/repositories/*`). Never query the DB or call an API from a screen/component/hook/store. Backend is injected, not imported.
- **State:** Zustand (`src/store`) for cross-screen state; local `useState`/hooks otherwise. Narrow selectors.
- **Navigation:** React Navigation native-stack; add routes to `RootStackParamList`.
- **Styling:** NativeWind `className` + `src/theme/colors`; RTL via `src/theme/rtl`.
- **Localization:** react-i18next; keys in both `ar.json` and `en.json`. Arabic-first / RTL.
- **Offline-first:** costing is WAC (weighted moving average) derived from purchase lines — preserve the invariant.

Never bypass the repository layer or put business/data logic inside components.
