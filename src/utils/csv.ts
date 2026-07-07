// Dependency-free CSV codec. RFC-4180-ish: comma-delimited, double-quote
// quoting, "" escapes a literal quote inside a quoted field, fields may span
// newlines when quoted. Tolerates CRLF/LF and a leading UTF-8 BOM (Excel adds
// one). Used by the stock CSV import + template export — no papaparse dep.

const BOM = '﻿';

/**
 * Parse CSV text into a matrix of string cells. Every row is returned verbatim
 * (no header handling, no trimming) so callers own the schema mapping. A final
 * trailing newline does not produce a spurious empty row; a blank line in the
 * middle yields a single empty-string cell row (callers skip empties).
 */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Swallow CRLF as one break; a lone CR also ends the row.
      if (src[i + 1] === '\n') i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush the last field/row unless the input ended exactly on a row break.
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** Quote a cell only when it contains a comma, quote, or newline. */
function encodeCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/** Serialize a matrix to CSV text (CRLF line breaks, Excel-friendly). */
export function buildCsv(rows: string[][]): string {
  return rows.map((r) => r.map(encodeCell).join(',')).join('\r\n');
}
