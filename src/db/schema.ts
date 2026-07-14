import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Conventions (data-model.md canonical):
// - id: client-generated string (UUID). 4 standard cols on every table.
// - created_at / updated_at: epoch-ms integers. deleted_at: soft-delete (null = live).
// - money: INTEGER minor units. never float.

const standard = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const items = sqliteTable('items', {
  ...standard,
  name: text('name').notNull(),
  category: text('category'), // category name/key (matches categories.name); null = uncategorized
  barcode: text('barcode'),
  unit: text('unit').notNull().default('pcs'),
  costPrice: integer('cost_price').notNull().default(0), // minor units
  salePrice: integer('sale_price').notNull().default(0), // minor units (the LIST price — never overwritten by a negotiated sale)
  currency: text('currency').notNull().default('EGP'),
  // 'fixed' = one price, rate field is read-only on a sale (override still possible).
  // 'negotiable' = haggled at the counter; the rate field opens for typing.
  pricingMode: text('pricing_mode').notNull().default('fixed'), // 'fixed' | 'negotiable'
  minPrice: integer('min_price'), // minor units; null = no floor. Warns, never blocks.
  lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
  photoUri: text('photo_uri'),
  // Denormalized JSON array of tag names (registry lives in `tags`). Stored on
  // the row so reads need zero joins; null = no tags.
  tags: text('tags'),
  notes: text('notes'),
});

// User-extensible category registry. `name` is the key stored on items.category;
// `i18nKey` is set for the seeded defaults (translated) and null for user-added
// ones (whose `name` is shown verbatim).
export const categories = sqliteTable('categories', {
  ...standard,
  name: text('name').notNull().unique(),
  color: text('color'), // theme color token (e.g. 'emerald')
  icon: text('icon'), // MaterialCommunityIcons glyph name
  i18nKey: text('i18n_key'), // e.g. 'tshirts' → inventory.categories.tshirts; null = use name
  sortOrder: integer('sort_order').notNull().default(0),
});

// Tag registry — autocomplete + known-tag list only. Items do NOT join here;
// each item carries its own `tags` array. Names are unique.
export const tags = sqliteTable('tags', {
  ...standard,
  name: text('name').notNull().unique(),
});

// Immutable movement ledger. On-hand is derived, never hand-edited.
// direction: +1 incoming, -1 outgoing.
// A document is a 'draft' (no stock effect) until 'posted' (materialized into
// stock_levels). doc_no is the human sequence (IN-000001 / OUT-000001).
export const documents = sqliteTable('documents', {
  ...standard,
  kind: text('kind').notNull(), // 'in' | 'out'
  direction: integer('direction').notNull(), // +1 | -1
  status: text('status').notNull().default('posted'), // 'draft' | 'posted'
  docNo: text('doc_no'), // human sequence, unique per kind
  docDate: integer('doc_date'), // epoch ms the doc represents
  totalAmount: integer('total_amount').notNull().default(0), // cached Σ line totals, minor units
  postedAt: integer('posted_at'), // epoch ms when posted
  // Counterparty FK: suppliers.id for incoming, customers.id for outgoing.
  // null = walk-in (direct cash, no registered party). Kind picks the table.
  partyId: text('party_id'),
  note: text('note'), // free-text note the owner typed on the document
  // Receipt attachments: JSON [{ id, name, mime, size }] metadata only. The bytes
  // live in the separate attachments.db (BLOB), loaded lazily. null = none.
  attachments: text('attachments'),
});

export const documentLines = sqliteTable('document_lines', {
  ...standard,
  documentId: text('document_id').notNull(),
  itemId: text('item_id').notNull(),
  qty: integer('qty').notNull(), // positive; sign comes from document.direction
  unitPrice: integer('unit_price').notNull().default(0), // minor units — what it ACTUALLY sold for
  // The item's list price at the moment of sale (minor units; null on purchases
  // and on legacy rows). unitPrice < listPrice ⇒ a discount was given. Recorded
  // here because it is impossible to reconstruct later — items.sale_price moves.
  listPrice: integer('list_price'),
  // Fast-entry provenance: the typed title/note/photo for this line. itemId
  // stays the ledger identity; these describe the individual entry.
  title: text('title'),
  note: text('note'),
  imageUri: text('image_uri'),
});

// Cached derived on-hand per item (rebuildable from the ledger).
export const stockLevels = sqliteTable('stock_levels', {
  itemId: text('item_id').primaryKey(),
  qtyOnHand: integer('qty_on_hand').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

// Parties.
//
// `balance` is RETIRED (see docs/.../supplier-debt-spec.md §3.4). It was only
// ever written as 0 at creation, and every consumer that read it rendered a
// permanent zero. Debt is now DERIVED from documents − transactions (see
// debt-repository). The column stays only because dropping it means a SQLite
// table rebuild; NO code may read or write it.
//
// `is_system` marks a sentinel (null-object) party — the seeded walk-in rows
// that absorb "no supplier"/"no customer" documents so `party_id` is never
// null. Sentinels are hidden from lists/counts, are un-editable and
// un-archivable, and are excluded from every debt figure — but their money
// still moves the cash book. See src/db/sentinels.ts.
export const customers = sqliteTable('customers', {
  ...standard,
  name: text('name').notNull(),
  phone: text('phone'),
  /** @deprecated retired — debt is derived. Never read, never written. */
  balance: integer('balance').notNull().default(0),
  isSystem: integer('is_system').notNull().default(0), // 1 = sentinel
});

export const suppliers = sqliteTable('suppliers', {
  ...standard,
  name: text('name').notNull(),
  phone: text('phone'),
  /** @deprecated retired — debt is derived. Never read, never written. */
  balance: integer('balance').notNull().default(0),
  isSystem: integer('is_system').notNull().default(0), // 1 = sentinel
});

// THE CASH BOOK. Every single movement of money, in or out, no exceptions —
// this is not a "payments" table; paying a supplier is merely one reason money
// moves. Debt is `documents` minus these rows, so a payment is the only event
// the schema was ever missing.
//
// `amount` is ALWAYS POSITIVE (minor units); the sign lives in `direction`
// (+1 in, −1 out) — enforced by CHECK constraints in the DDL, so a bad write
// fails at the SQL layer and rolls its enclosing transaction back.
//
// `ref_kind`/`ref_id` is the engine: an untyped polymorphic FK resolved by the
// sibling kind column (house convention — `documents.party_id` works the same
// way). No SQL FK constraint.
//   'supplier' → suppliers.id — you paid Ahmed; REDUCES his derived debt   (−1)
//   'expense'  → expenses.id  — you paid rent                              (−1)
//   'sale'     → documents.id — the customer paid you                      (+1)
//   'owner'    → null         — drawings / capital injection               (±1)
//   'transfer' → null         — drawer ↔ InstaPay: TWO rows netting to 0   (±1)
//   'other'    → null         — escape hatch                               (±1)
//
// `account` must be a real column: cash and InstaPay are two separate pockets
// that each reconcile independently. A row that doesn't say which pocket can
// never be checked against either.
//
// `attachments` is PROOF OF MONEY (the InstaPay screenshot) and is distinct
// from `documents.attachments`, which is PROOF OF GOODS (the paper invoice).
// Three installments = three payments = three separate proofs, which is exactly
// why a single `paid_amount` column on the document is impossible.
//
// `doc_id` is PROVENANCE, NOT ALLOCATION — read this before touching it.
//
// It is set ONLY on a row BORN WITH a document: the money handed over at the
// counter as the purchase was saved, and the customer's payment for a sale. It
// answers exactly one question — "was this money row created as part of that
// document?" — and it exists for exactly one reason: `documentRepository.remove()`
// must take those rows down WITH the document. Without it, deleting a part-paid
// purchase leaves its payment alive against an invoice that no longer exists,
// and `owed(supplier)` goes NEGATIVE: a phantom credit the owner never earned.
//
// It is NOT an allocation link, and the FIFO settlement walk (debt-repository)
// ignores it COMPLETELY. A payment still points at the SUPPLIER via ref_id, and
// that is what keeps the allocation problem collapsed. A payment made later
// through the سداد sheet carries doc_id = NULL and therefore SURVIVES the
// deletion of any invoice — correctly, because that money really did move at the
// supplier level. Start allocating on this column and the whole design unravels.
export const transactions = sqliteTable('transactions', {
  ...standard,
  direction: integer('direction').notNull(), // +1 money IN, -1 money OUT
  amount: integer('amount').notNull(), // minor units, ALWAYS POSITIVE
  occurredAt: integer('occurred_at').notNull(), // when money MOVED (not when typed)
  account: text('account').notNull(), // 'cash' | 'instapay'
  refKind: text('ref_kind'), // why it moved
  refId: text('ref_id'), // what it points at, resolved by ref_kind
  // PROVENANCE, never allocation. Non-null ⇔ this row was written by
  // documentRepository.create() for that document, and dies with it.
  docId: text('doc_id'),
  note: text('note'),
  attachments: text('attachments'), // JSON metadata — PROOF OF MONEY
});

// EXPENSES — rent, electricity, salaries, repairs. Real obligations, not a
// mock list (they were `DEMO_EXPENSES` until Epic 3).
//
// RENT IS DEBT TOO. Debt is not derived from purchase invoices alone — it comes
// from OBLIGATIONS, and a purchase invoice is only one thing that creates one.
// An expense creates one with no goods, no lines and no document at all.
//
// There is deliberately NO `paid` column, no `settled` flag and no cached
// balance. An expense's debt is:
//
//   owed(E) = expenses.total_amount
//           − Σ transactions.amount WHERE ref_kind='expense' AND ref_id=E
//                                     AND deleted_at IS NULL
//
// — the SAME rule that derives supplier debt. One concept, not two. A stored
// paid-flag would be a second source of truth for a number the transactions
// already answer, and the day the two disagree the owner cannot tell which lies.
//
// `party_name` is FREE TEXT, not a supplier FK: the landlord sells the shop
// nothing, and must not pollute the Suppliers list (or the supplier debt book).
//
// `attachments` is the bill/receipt photo — JSON metadata, bytes in attachments.db.
export const expenses = sqliteTable('expenses', {
  ...standard,
  title: text('title').notNull(),
  category: text('category'), // 'rent' | 'salaries' | 'utilities' | 'transport' | 'other' | null
  totalAmount: integer('total_amount').notNull(), // minor units, always positive
  incurredAt: integer('incurred_at').notNull(), // when the obligation arose
  partyName: text('party_name'), // free text — the landlord is NOT a supplier
  note: text('note'),
  attachments: text('attachments'),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
export type NewExpenseRow = typeof expenses.$inferInsert;
