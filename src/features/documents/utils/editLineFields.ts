import type { DocMode } from '../types';

/**
 * Which fields the Edit-Line sheet offers, driven by the document DIRECTION —
 * a single source of truth rather than conditionals scattered through the sheet.
 *
 * Sale (outgoing): the owner is haggling a price and adjusting a count against a
 * catalog item — qty, unit price (min-price guarded), and a line note. He does
 * NOT rename a catalog item mid-sale; that would silently fork the catalog.
 *
 * Purchase (incoming): lines are often ad-hoc / fast-entry that only become real
 * items at save, so their whole descriptor is still editable — title, unit cost,
 * qty, category, tags, note.
 */
export type EditLineField = 'name' | 'unitPrice' | 'qty' | 'category' | 'tags' | 'note';

const SALE_FIELDS: readonly EditLineField[] = ['qty', 'unitPrice', 'note'];
const PURCHASE_FIELDS: readonly EditLineField[] = [
  'name',
  'unitPrice',
  'qty',
  'category',
  'tags',
  'note',
];

export const editLineFields = (mode: DocMode): readonly EditLineField[] =>
  mode === 'sale' ? SALE_FIELDS : PURCHASE_FIELDS;

export const hasEditLineField = (mode: DocMode, field: EditLineField): boolean =>
  editLineFields(mode).includes(field);
