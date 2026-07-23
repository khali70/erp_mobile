# Rafuf (رفوف)

Arabic-first, offline-first retail ERP mobile app built with Expo + React Native.

## Quick Start

```bash
bun install
bunx expo run:android    # build & install dev client
bunx expo start --dev-client
```

## Documentation

- **[Development Guide](./dev.md)** — building the dev client, running the dev
  server, native modules, and when to rebuild vs reload.

## Tech Stack

- Expo SDK 57 / React Native 0.86
- expo-sqlite + drizzle-orm (local DB)
- zustand (state), nativewind (styling), i18next (RTL / Arabic)
