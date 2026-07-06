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
  barcode: text('barcode'),
  unit: text('unit').notNull().default('pcs'),
  costPrice: integer('cost_price').notNull().default(0), // minor units
  salePrice: integer('sale_price').notNull().default(0), // minor units
  currency: text('currency').notNull().default('EGP'),
  photoUri: text('photo_uri'),
});

// Immutable movement ledger. On-hand is derived, never hand-edited.
// direction: +1 incoming, -1 outgoing.
export const documents = sqliteTable('documents', {
  ...standard,
  kind: text('kind').notNull(), // 'in' | 'out'
  direction: integer('direction').notNull(), // +1 | -1
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

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
