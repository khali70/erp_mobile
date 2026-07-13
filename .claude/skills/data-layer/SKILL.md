---
name: data-layer
description: Offline-first data access standards for this Expo ERP app — Drizzle ORM schema, generated migrations, and the repository pattern over expo-sqlite (no REST backend). Use when adding or changing tables, queries, mutations, repositories, or any local persistence logic.
---

# Skill: Data Layer

## Purpose

Generate offline-first data access and business logic as an **isolated, swappable layer**. Today data lives in local SQLite (expo-sqlite) via Drizzle ORM, accessed through repositories. Tomorrow the same app must be able to swap in a **remote data source** (HTTP / multi-tenant backend) with **zero changes above the repository layer**. Every rule here exists to protect that seam.

## Architecture — the seam

```
UI / screens / components
        │ depend on ↓ (types + repo interface only)
Hooks (useXList / useXDetail / useXForm)
        │ call ↓
Repository INTERFACE (the port)   ←— consumers bind to THIS, never a concrete impl
        │ implemented by ↓
Repository IMPL (SQLite/Drizzle today · RemoteHttp tomorrow)
        │ receives its backend by ↓
Injected data source (DocDb / apiClient) — never imported inside impl or consumers
```

Direction of dependency: **inward, toward the interface**. Higher layers never know which backend is wired. This is Dependency Inversion (the D in SOLID): high-level policy (hooks, features) and low-level detail (SQLite) both depend on the abstraction (the repo interface), not each other.

## SOLID mapping (why each rule)

- **S** — one repository per aggregate (item, document, customer…). One reason to change.
- **O** — add a new backend by writing a new impl of the interface; don't edit callers.
- **L** — every impl of a repo interface is fully substitutable. Same signatures, same typed errors, same invariants (WAC). A remote impl must behave like the local one.
- **I** — keep interfaces focused. A screen needing reads shouldn't depend on mutation methods it never calls. Split read/write ports if a consumer only needs one.
- **D** — consumers depend on the interface; the concrete impl + its DB/api handle are injected via a factory, never imported directly.

## Responsibilities

Generate, as needed:

- Drizzle table/schema (`src/db/schema.ts`) — SQLite-backed impl only
- Migration (via `npm run db:generate` — never hand-write)
- **Repository interface** (the port) — the typed contract consumers bind to
- **Repository impl** via factory (`src/repositories/<name>-repository.ts`) — `createXRepository(dataSource)` returns an object implementing the interface
- Client wrapper (`*-repository.client.ts`) — the composition root: binds the production singleton to the real backend
- Feature-local types (`src/features/<feature>/types.ts`)
- A hook that consumes the repository **through its interface** (`useXList` / `useXDetail` / `useXForm`)
- Zustand store slice only if cross-screen state is genuinely needed

## Rules

### Layer isolation (the hard rules)
- **All DB/API access goes through repositories** — never query SQLite/Drizzle or call an HTTP client from a screen, hook, component, or store.
- **The backend handle is injected, never imported inside a repo impl or consumer.** A repo receives its `DocDb` (or future `apiClient`) as a factory arg. `import { db }` lives ONLY in `*-repository.client.ts` (the composition root).
- **Consumers depend on the interface, not the factory or impl.** Hooks/features import the repo type + the bound singleton; they must not care whether it's SQLite or remote.
- **No raw rows cross the layer.** Return clean typed domain shapes; Drizzle row types, SQL fragments, and column names stay inside the impl. This is what lets a remote impl return the same shapes.

### DI shape (mirror existing repos)
- Factory pattern: `export function createXRepository(db: DocDb) { return { ...methods }; }` — matches `document-repository.ts` / `item-repository.ts`.
- Client wrapper is the ONLY place that reaches for `@/db/client`:
  ```ts
  export const itemRepository = createItemRepository(db as unknown as DocDb);
  ```
- Tests build their own impl over an in-memory db via the same factory — proof the seam works.
- To go multi-tenant later: define a `RemoteDocSource` implementing the same interface, add `createXRemoteRepository(apiClient)`, and swap the binding in the client wrapper. Nothing above changes.

### Integrity & correctness
- Wrap multi-step writes in a transaction to keep offline data integrity. (Design the interface so a remote impl can honor the same atomicity — batch/unit-of-work method, not N separate calls.)
- Keep the WAC (weighted moving average) costing invariant intact — cost derived from purchase lines; don't bypass it. Any impl must uphold it.
- Handle and surface errors as typed domain errors (`NegativeStockError`) — part of the interface contract, so a remote impl throws the same ones. Never swallow with empty `catch`.
- Add an index for hot query columns (SQLite impl).

## Checklist

✓ Repository **interface / typed contract** defined (methods, shapes, typed errors)

✓ Schema / table (if new)

✓ Migration generated (`npm run db:generate`)

✓ Repository impl via `createXRepository(dataSource)` factory — no direct `db` import inside

✓ Client wrapper binds production singleton (composition root — only place importing `@/db/client`)

✓ Types (clean domain shapes — no raw rows leaked)

✓ Hook consumes repo **through the interface / bound singleton**

✓ Transaction (or unit-of-work method) around multi-step writes

✓ No DB/API access in screens, components, hooks, or stores

✓ Tests (`*-repository.test.ts` build a repo over the better-sqlite3 test DB via the factory)

✓ `npm run typecheck` + `npm test` pass
