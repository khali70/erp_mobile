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
├── repositories/   # data access over Drizzle/expo-sqlite (the ONLY place that touches the DB)
├── services/       # cross-cutting services (e.g. backup)
├── store/          # Zustand stores (settings-store, ui-store, mmkv)
├── theme/          # colors, rtl helpers
└── utils/          # shared helpers (money, numerals, ...)
```

Existing features to mirror: `documents`, `inventory`, `parties`, `cashbook`, `expenses`, `reports`, `scan`, `settings`.

## Core Rules

- **Data access only via repositories** (`src/repositories/*`) over Drizzle + expo-sqlite. Never query the DB from a screen/component.
- **State:** Zustand (`src/store`) for cross-screen state; local `useState`/hooks otherwise. Narrow selectors.
- **Navigation:** React Navigation native-stack; add routes to `RootStackParamList`.
- **Styling:** NativeWind `className` + `src/theme/colors`; RTL via `src/theme/rtl`.
- **Localization:** react-i18next; keys in both `ar.json` and `en.json`. Arabic-first / RTL.
- **Offline-first:** costing is WAC (weighted moving average) derived from purchase lines — preserve the invariant.

Never bypass the repository layer or put business/data logic inside components.
