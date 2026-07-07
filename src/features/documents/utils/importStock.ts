import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseCsv, buildCsv } from '@/utils/csv';
import { newId } from '@/utils/id';

// Maps a stock CSV into editable draft rows for the review sheet. Headers are
// matched case-insensitively against known aliases (English + Arabic), so column
// order is free and either language works. Only name/qty/cost are required to
// post a purchase line; the rest seed the find-or-created item.

/** An editable import row. Numeric fields stay strings for in-place editing. */
export interface ImportRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: string; // major units, as typed
  qty: string;
  salePrice: string; // major units
  barcode: string;
  tags: string[];
  note: string;
}

type Field = keyof Omit<ImportRow, 'id' | 'tags'> | 'tags';

// Canonical field ← accepted header aliases (all compared lowercased+trimmed).
const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['name', 'title', 'item', 'الاسم', 'الصنف', 'اسم الصنف'],
  qty: ['qty', 'quantity', 'count', 'الكمية', 'كمية'],
  cost: ['cost', 'costprice', 'cost price', 'unitcost', 'unit cost', 'التكلفة', 'سعر الشراء', 'سعر التكلفة'],
  category: ['category', 'cat', 'الفئة', 'التصنيف'],
  unit: ['unit', 'الوحدة', 'وحدة'],
  salePrice: ['saleprice', 'sale price', 'price', 'سعر البيع', 'البيع'],
  barcode: ['barcode', 'code', 'الباركود', 'باركود'],
  tags: ['tags', 'tag', 'الوسوم', 'وسوم'],
  note: ['note', 'notes', 'ملاحظات', 'ملاحظة'],
};

const norm = (s: string) => s.trim().toLowerCase();

/** Resolve a header row to a field → column-index map. */
function mapHeaders(header: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  header.forEach((raw, idx) => {
    const key = norm(raw);
    for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
      if (map[field] === undefined && HEADER_ALIASES[field].includes(key)) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

export interface ParseStockResult {
  rows: ImportRow[];
  /** i18n key describing why parsing produced nothing usable, if any. */
  errorKey?: string;
}

/**
 * Parse stock CSV text into editable rows. Returns an `errorKey` (not thrown)
 * for the empty-file / missing-required-column cases so the caller can Alert.
 */
export function parseStockCsv(text: string): ParseStockResult {
  const grid = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (grid.length < 2) return { rows: [], errorKey: 'documents.import.errors.empty' };

  const cols = mapHeaders(grid[0]);
  if (cols.name === undefined || cols.qty === undefined || cols.cost === undefined) {
    return { rows: [], errorKey: 'documents.import.errors.missingColumns' };
  }

  const at = (row: string[], field: Field): string => {
    const idx = cols[field];
    return idx === undefined ? '' : (row[idx] ?? '').trim();
  };

  const rows: ImportRow[] = grid.slice(1).map((r) => ({
    id: newId(),
    name: at(r, 'name'),
    category: at(r, 'category'),
    unit: at(r, 'unit') || 'piece',
    cost: at(r, 'cost'),
    qty: at(r, 'qty'),
    salePrice: at(r, 'salePrice'),
    barcode: at(r, 'barcode'),
    tags: at(r, 'tags')
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean),
    note: at(r, 'note'),
  }));

  return { rows };
}

/** Positive finite parse; blank/garbage → NaN so validation can flag it. */
export const parseAmount = (s: string): number => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** i18n keys for each validation problem on a row (empty array = valid). */
export function validateRow(row: ImportRow): string[] {
  const errors: string[] = [];
  if (!row.name.trim()) errors.push('documents.import.rowErrors.name');
  const qty = parseAmount(row.qty);
  if (!(qty > 0)) errors.push('documents.import.rowErrors.qty');
  const cost = parseAmount(row.cost);
  if (!(cost > 0)) errors.push('documents.import.rowErrors.cost');
  return errors;
}

export const isRowValid = (row: ImportRow) => validateRow(row).length === 0;

// Header + one sample data row for the downloadable template.
const TEMPLATE_ROWS: string[][] = [
  ['name', 'category', 'unit', 'cost', 'saleprice', 'qty', 'barcode', 'tags', 'note'],
  ['White cotton T-shirt', 'tshirts', 'piece', '80', '120', '25', '6221000000001', 'summer;cotton', 'opening stock'],
];

export const STOCK_TEMPLATE_CSV = buildCsv(TEMPLATE_ROWS);

/**
 * Write the template CSV to the cache dir and hand it to the OS share sheet so
 * the user can save it (Downloads / Files / Drive), fill it in, and re-import.
 * Mirrors the settings backup flow. Returns false if sharing is unavailable.
 */
export async function exportStockTemplate(): Promise<boolean> {
  const file = new File(Paths.cache, 'stock-template.csv');
  if (file.exists) file.delete();
  file.create();
  file.write(STOCK_TEMPLATE_CSV);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'stock-template.csv',
  });
  return true;
}
