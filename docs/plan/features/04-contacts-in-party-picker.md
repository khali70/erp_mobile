# Feature 4 — Phone Contacts When Typing a Supplier / Customer

**Status:** proposed
**Verdict:** 🟡 **Worth it — but it's the *second* thing to fix in this screen, not the first.**

While scoping this, a bigger problem surfaced in the same six lines of code: **party search is effectively broken for Arabic input.** Fix that first (~2 hours, no permissions, no dependency). Then add contacts (~1 day).

---

## 1. What exists today

`src/features/documents/components/PartyPicker.tsx` — a bottom sheet, not a typeahead-in-field.

- **Search** (L35): client-side substring filter over the already-loaded list, matching name **or** phone:
  ```ts
  parties.filter((p) => p.name.includes(q) || p.phone.includes(q))
  ```
- **Walk-in** shortcut → selects `null`, no party (L67–76)
- **Inline quick-add** appears only when `query.trim().length > 0 && filtered.length === 0` (L38), rendered L94–114
- **Quick-add** (`useDocumentForm.ts:399–411`): if the query is all digits (`/^[0-9]+$/`) it seeds `phone`, otherwise it seeds `name`; `saveQuickAdd` calls `createParty` and selects the result immediately
- Routes to `customerRepository` for sales, `supplierRepository` for purchases (`useParties.ts:36–44`) — same tables the Parties feature edits, one source of truth. Clean.

Schema (`src/db/schema.ts:96–107`): `customers` and `suppliers` are structurally identical — `name` (NOT NULL), `phone` (nullable), `balance` (minor units, ledger-derived, never written by the party repos).

**The flow is well-built.** The problems are in the matching, not the plumbing.

---

## 2. The bug you should fix first: Arabic search does not work

`p.name.includes(q)` is a raw, case-sensitive, **unnormalized** JavaScript substring match. On Arabic text, this fails constantly and invisibly. It will look to the merchant like *"the app can't find my customer"* — and he will conclude the app is broken, which is the correct conclusion.

| The merchant types | Stored as | `.includes()` |
|---|---|---|
| `احمد` | `أحمد` | ❌ no match — alef hamza |
| `اسماعيل` | `إسماعيل` | ❌ |
| `فاطمه` | `فاطمة` | ❌ — taa marbuta vs haa |
| `يحيي` | `يحيى` | ❌ — alef maqsura |
| `٠١٢٣٤٥` | `012345` | ❌ — Arabic-Indic digits |
| `محمد ` (trailing space) | `محمد` | ❌ — `q` is never trimmed on this path |
| `Ahmed` | `ahmed` | ❌ — case |

**Every one of these is a name a real Egyptian shopkeeper types every day.** And the failure is worse than silent: when the filter returns empty, the UI shows the **quick-add card** (L38). So the merchant types `احمد`, doesn't find the `أحمد` who already exists, and **creates a duplicate**. Now there are two Ahmeds with split balances, and the debt figure — one of the four questions `docs/PROJECT.md` says this app exists to answer — is wrong.

**This is a data-integrity bug wearing a UX bug's clothes.**

### The fix (~2 hours, no dependency, no permission)

One shared normalizer in `src/utils/`, applied to **both sides** of every comparison. Verified in node against every row of the table above — all six pass.

```ts
export function normalizeArabic(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '')      // tashkeel / diacritics
    .replace(/ـ/g, '')                  // tatweel ـ
    .replace(/[أإآٱ]/g, 'ا')                  // alef variants
    .replace(/ى/g, 'ي')                       // alef maqsura
    .replace(/ة/g, 'ه')                       // taa marbuta
    .replace(/[ؤئ]/g, 'ء')                    // hamza carriers
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))  // Arabic-Indic digits
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))  // Eastern Arabic digits
    .replace(/\s+/g, ' ');
}

export function normalizePhone(s: string): string {
  return normalizeArabic(s).replace(/[\s\-()+]/g, '');
}
```

Then `PartyPicker.tsx:35` becomes a comparison between two normalized strings. Phones need their own pass — `0100 123 4567`, `01001234567`, and `+2 0100 123 4567` are the same number and none of them `.includes()` each other.

**Use the same normalizer in `LineItemPicker.tsx:28-32`** — item search has the identical bug (`i.name.includes(q)`, case-sensitive, no barcode match).

**And add a duplicate guard on quick-add:** before `createParty`, check for a normalized-name match and, if one exists, show *"عميل بنفس الاسم موجود — تقصد ده؟"* rather than silently minting a second row. The quick-add card firing on an empty filter result is exactly the moment a duplicate gets born.

---

## 3. Now, contacts

### The case for

The merchant's customers and suppliers are **already in his phone**. He has been calling them for years. Making him retype a name and an 11-digit number he already has is pointless friction, and it's friction at the worst possible moment: mid-sale, customer waiting. Retyped phone numbers are also **wrong** — a digit gets dropped, and the number is now useless for the thing phone numbers are for (chasing a debt).

Two hills in `docs/PROJECT.md`: *speed of data entry* and *never lose data*. Contacts import serves the first directly.

### The case against

`READ_CONTACTS` is one of Android's most sensitive permissions. It triggers extra Play Store data-safety declarations, and a chunk of users deny it reflexively. If the feature is built such that denial breaks the flow, you've made the app worse for everyone who says no.

### The design that resolves it: **lazy, opt-in, degradable**

**Do not** request contacts permission at startup, or on first open of the picker. **Do not** bulk-import the address book into `customers`.

Instead: the merchant types a name. It doesn't match any existing party. **The empty state — which today shows only the quick-add card — grows one more option:**

```
┌──────────────────────────────────────┐
│  لا يوجد عميل باسم "أحمد"              │
│                                      │
│  [ + عميل جديد: أحمد ]                │  ← exists today
│  [ 📇 بحث في جهات الاتصال ]            │  ← new. permission requested HERE
└──────────────────────────────────────┘
```

- Permission is requested at the **exact moment its purpose is obvious**, which is the only time users grant it.
- Denied → the button quietly disappears, quick-add still works. **Nothing is broken.**
- Granted → search contacts by the same normalized query, list matches, tap one → prefills `PartyFormSheet` with name **and** phone → merchant confirms → `createParty` → auto-selected into the document. It slots straight into the existing `openQuickAdd`/`saveQuickAdd` path (`useDocumentForm.ts:399–411`) — that hook already prefills the sheet and selects the created party. **Almost no new flow to build.**

**Copy only name + phone.** Not email, not address, not photo. You are not a CRM, and the less you hold the less you leak (relevant given the plaintext backup — see Feature 3).

**Never write back** to the phone's contacts. One-directional, always.

### Implementation

- `expo-contacts` (not currently in `package.json` — one new dep)
- `Contacts.requestPermissionsAsync()` on button tap only
- `Contacts.getContactsAsync({ fields: [Name, PhoneNumbers] })`, filter in memory with `normalizeArabic` / `normalizePhone`
- Cache the fetched list for the session; on a large address book this is slow to re-read per keystroke
- Android manifest declaration + Play Store data-safety form entry
- Match against **existing parties first** — if the picked contact's normalized phone already belongs to a party, **select that party instead of creating a duplicate.** Same duplicate trap as §2, different door.

---

## 4. Is it worth it?

**The Arabic normalization: unambiguously yes. Do it this week.** Two hours, no dependency, no permission, and it fixes a bug that is silently corrupting the debt ledger — the app's single most important number — by minting duplicate parties. It also fixes item search for free. **This is the highest-value two hours in the whole backlog.**

**Contacts: yes, but it's a solid B, not an A.**

- **Cost:** ~1 day, one dependency, one sensitive permission, one Play Store declaration.
- **Value:** real but bounded. It saves ~15 seconds and one wrong-digit bug **per new party** — and new parties are a small fraction of transactions in a shop with regulars. Once a customer is in the DB, this feature never fires again for him.
- **Risk:** low, *if* built as lazy/opt-in/degradable. **High if not** — a startup permission prompt for contacts is the kind of thing that gets an app uninstalled before the first sale is recorded.

**The honest ranking within this brief:** normalization is the fix, contacts is the polish. Shipping contacts on top of a search that can't match `احمد` to `أحمد` would be building a nicer front door onto a house with a hole in the floor.

---

## 5. Definition of done

**Phase 1 — normalization (~2h)**
- [ ] `normalizeArabic` / `normalizePhone` in `src/utils/`, unit-tested against the table in §2
- [ ] `PartyPicker.tsx:35` compares normalized ↔ normalized, both sides
- [ ] `LineItemPicker.tsx:28-32` uses the same normalizer (+ match on barcode, which it currently doesn't)
- [ ] Quick-add checks for a normalized-name collision and offers the existing party before creating a new one

**Phase 2 — contacts (~1d)**
- [ ] `expo-contacts` added; permission requested **only** on explicit button tap inside the empty state
- [ ] Denial degrades silently; quick-add path unaffected
- [ ] Contact search uses the same normalizer
- [ ] Only `name` + `phone` are copied; never written back to the address book
- [ ] A contact whose normalized phone matches an existing party **selects** that party instead of creating a duplicate
- [ ] Play Store data-safety declaration updated
