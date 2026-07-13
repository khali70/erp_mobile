## FEATURE NAME

Suppliers List Feature

---

## REFERENCE (optional)

Same layout as `src/features/parties/screens` — or attach a screenshot / sketch.

---

## DATA SPEC

Local SQLite (Drizzle), accessed via a repository — no REST backend.

Entity: Supplier
- id: string (uuid)
- name: string
- phone: string | null
- balance: integer (minor units)
- createdAt: number (epoch ms)

Repository: `src/repositories/supplier-repository.ts`
- listSuppliers(): Supplier[]
- getSupplier(id): Supplier | null
- createSupplier(input): Supplier

---

## BEHAVIOR

- Screen lists suppliers from the local DB (via a `useSuppliers` hook)
- Show loading + empty states
- Tap a row → navigate to Supplier detail
- Pull-to-refresh re-reads the repository
- Search filters the list (debounced)

---

## REQUIREMENTS

- Support Arabic/English (RTL-first)
- NativeWind + theme tokens (`src/theme/colors`), RTL via `src/theme/rtl`
- Feature-first structure (screens compose / hooks own logic / repository owns data)
- Zustand only if cross-screen state is needed
- Reuse existing `src/components/ui/*` (e.g. `ScreenHeader`, `SearchBar`)
- FlatList for the list

---

## NOTES (optional)

- No backend sync in this feature
- Balance shown with the numerals util (Arabic digits)
