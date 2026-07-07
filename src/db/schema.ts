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
  salePrice: integer('sale_price').notNull().default(0), // minor units
  currency: text('currency').notNull().default('EGP'),
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
  note: text('note'),
});

export const documentLines = sqliteTable('document_lines', {
  ...standard,
  documentId: text('document_id').notNull(),
  itemId: text('item_id').notNull(),
  qty: integer('qty').notNull(), // positive; sign comes from document.direction
  unitPrice: integer('unit_price').notNull().default(0), // minor units
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

// Parties. `balance` is minor units; sign encodes direction of debt:
//   customers: + = customer owes the shop (receivable / ديون لك)
//   suppliers: + = shop owes the supplier (payable / ديون عليك)
export const customers = sqliteTable('customers', {
  ...standard,
  name: text('name').notNull(),
  phone: text('phone'),
  balance: integer('balance').notNull().default(0),
});

export const suppliers = sqliteTable('suppliers', {
  ...standard,
  name: text('name').notNull(),
  phone: text('phone'),
  balance: integer('balance').notNull().default(0),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
