# Skill: Data Layer

## Purpose

Generate offline-first data access and business logic according to this repo's standards. This app stores data locally in SQLite (expo-sqlite) via Drizzle ORM, accessed through the repository pattern — there is generally **no REST backend**.

## Responsibilities

Generate, as needed:

- Drizzle table/schema (`src/db/schema.ts`)
- Migration (via `npm run db:generate` — never hand-write)
- Repository (`src/repositories/<name>-repository.ts`) with query + mutation functions
- Client wrapper where the pattern exists (`*-repository.client.ts`)
- Feature-local types (`src/features/<feature>/types.ts`)
- A hook that consumes the repository (`useXList` / `useXDetail` / `useXForm`)
- Zustand store slice only if cross-screen state is genuinely needed

## Rules

- All DB access goes through repositories — never query SQLite/Drizzle from a screen or component.
- Wrap multi-step writes in a transaction to keep offline data integrity.
- Keep the WAC (weighted moving average) costing invariant intact — cost is derived from purchase lines; don't bypass it.
- Return clean typed shapes from repositories; don't leak raw rows across the app.
- Handle and surface errors meaningfully (typed errors like `NegativeStockError`); never swallow with empty `catch`.
- Add an index for hot query columns.
- Mirror an existing repository (`document-repository.ts`, `item-repository.ts`) for structure and error patterns.

## Checklist

✓ Schema / table (if new)

✓ Migration generated (`npm run db:generate`)

✓ Repository (queries + mutations)

✓ Client wrapper (if pattern exists)

✓ Types

✓ Hook consuming the repository

✓ Transaction around multi-step writes

✓ Tests (`*-repository.test.ts` using the better-sqlite3 test DB)

✓ `npm run typecheck` + `npm test` pass
