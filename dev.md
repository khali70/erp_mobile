# Development Guide

## Prerequisites

- [Bun](https://bun.sh) (package manager / runner)
- Android SDK + JDK 17 (for local Android builds)
- A connected Android device or emulator (`adb devices` should list one)

Install dependencies:

```bash
bun install
```

## Native Modules & Dev Client

This app uses **native modules** (e.g. `expo-camera`, `expo-audio`, `expo-sqlite`).
They are **not** available in Expo Go — you must build and install a **dev client** APK.

> `Cannot find native module 'ExpoAudio'` (or similar) means the installed APK
> is missing that native module. Reloading JS won't fix it — **rebuild the dev client.**

## Build Dev Client

### Fastest — one command (prebuild + compile + install)

```bash
bunx expo run:android
```

Compiles native code (including all native modules) and installs the dev-client
APK on the connected device.

### Step-by-step (more control)

```bash
# 1. add expo-dev-client (once)
bunx expo install expo-dev-client

# 2. generate the native project
bunx expo prebuild --platform android

# 3. compile + install
cd android && ./gradlew installDebug
```

### Cloud build (no local Android SDK) — EAS

```bash
bunx eas build --profile development --platform android
```

Download the APK when done and install it manually.

> **First local build is slow:** the `react-android` AAR (~200 MB) downloads once
> from Maven Central, then is cached. Native compile takes ~2–4 min afterwards.

## Run the Dev Server

After the dev client is installed:

```bash
bunx expo start --dev-client
```

Open the installed **dev app** on the device — it connects to Metro automatically.
Press `a` to launch on Android, `r` to reload JS, or shake the device for the dev menu.

## When to Rebuild vs Reload

| Change                                            | Action                          |
| ------------------------------------------------- | ------------------------------- |
| JS / TS / styles                                  | Reload (`r`) — no rebuild       |
| Add/remove a native module                        | **Rebuild dev client**          |
| Edit `app.json` plugins / permissions             | **Rebuild dev client**          |
| Bump Expo SDK                                      | **Rebuild dev client**          |

## Common Scripts

```bash
bun run start       # expo start
bun run android     # expo run:android (build + install)
bun run typecheck   # tsc --noEmit
bun run test        # jest
bun run lint        # eslint
bun run db:generate # drizzle-kit generate
```
