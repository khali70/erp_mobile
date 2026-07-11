# Skill: React Native Reviewer

## Purpose

Review generated code before completion.

## Responsibilities

Review: feature-first structure, naming conventions, error handling, performance, readability, maintainability.

## Review Checklist

### Structure

- Screens only compose + navigate + wire state
- Business/data logic in hooks + repositories, not JSX
- No SQLite/Drizzle access from components
- Data access goes through `src/repositories/*`

### Code Quality

- Meaningful names; PascalCase components, `useXxx` hooks
- Small, focused components (one per file)
- Reused `src/components/ui/*` and existing hooks; no duplication
- No inline `renderX()` JSX helpers

### Performance

- No unnecessary re-renders (stable props/callbacks, `React.memo` where hot)
- `FlatList` over `ScrollView` + `.map()` for long lists
- Narrow Zustand selectors

### RN / Conventions

- Localization: no hardcoded strings → `t('key')` in `ar.json` + `en.json`
- RTL-safe via `src/theme/rtl` helpers
- Colors/sizes via `src/theme/colors` / NativeWind tokens — no magic values
- User-facing numbers via numerals util where the app does
- No `console.log` left behind
- Navigation params typed in `RootStackParamList`

### Final Output

Provide: Issues Found · Suggested Improvements · Final Approval. Confirm `npm run typecheck` and `npm test` pass.
