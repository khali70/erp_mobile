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
  category: text('category'), // domain category key (e.g. 'tshirts'); null = uncategorized
  barcode: text('barcode'),
  unit: text('unit').notNull().default('pcs'),
  costPrice: integer('cost_price').notNull().default(0), // minor units
  salePrice: integer('sale_price').notNull().default(0), // minor units
  currency: text('currency').notNull().default('EGP'),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
  photoUri: text('photo_uri'),
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
export type Document = typeof documents.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
