#!/usr/bin/env node
//
// import-stock-db.mjs — build a RESTORABLE backup .db from a stock CSV.
//
//   node scripts/import-stock-db.mjs [in.csv] [out.db]
//   defaults: ~/Downloads/stock-template.csv  →  ~/Downloads/rafuf-stock.db
//
// Produces a MERGED backup (erp tables + attachments table + backup_meta),
// exactly the shape the app's Restore flow accepts (see backup-format.ts and
// scripts/make-empty-backup.sh). Restoring it REPLACES the live database.
//
// What it writes:
//   - categories : the 10 default categories (so the registry is populated)
//   - items      : one row per CSV line (cost/sale stored as INTEGER minor units)
//   - documents  : ONE posted incoming doc = the opening-stock ledger entry
//   - document_lines / stock_levels : opening on-hand, ledger-backed
//   - transactions : one +cash owner capital injection = the opening drawer
//
// Opening stock is booked against the walk-in SENTINEL supplier with NO payment
// (goods on the books, no cash out; sentinel debt is excluded from every figure).

import Database from 'better-sqlite3';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const IN = process.argv[2] ?? join(homedir(), 'Downloads', 'stock-template.csv');
const OUT = process.argv[3] ?? join(homedir(), 'Downloads', 'rafuf-stock.db');

// --- contract values (must match the app) --------------------------------
const FORMAT = 'erp-merged-backup';
const FORMAT_VERSION = 1;
const APP_SCHEMA_VERSION = Number(
  readFileSync(join(ROOT, 'src/db/schema-version.ts'), 'utf8').match(
    /APP_SCHEMA_VERSION = (\d+)/,
  )[1],
);
const NOW = Date.now();
const MINOR = 100; // EGP: 2-decimal minor units
const OPENING_CASH_MAJOR = 15500; // EGP in the drawer at start

// Money handed over with a purchase reduces cash; opening stock does NOT — it is
// stock you already own. So the doc carries no payment. The 15500 drawer is a
// separate owner capital injection, below.

// --- read the DDL (both sections → one merged file) ----------------------
const SRC = join(ROOT, 'src/db/prod-schema.sql');
const schemaSql = readFileSync(SRC, 'utf8');
const splitIdx = schemaSql.indexOf('attachments.db  (SEPARATE FILE');
if (splitIdx < 0) throw new Error('could not locate attachments section in prod-schema.sql');
// The whole file is safe to run against one connection: the erp section + the
// attachments CREATE TABLE. The comment banners are SQL comments.
const ddl = schemaSql;

// --- parse CSV (auto-detect tab vs comma; header row maps columns) -------
// Excel "CSV UTF-8" exports comma-separated; "Tab delimited Text" is tab. Sniff
// the header line for whichever delimiter appears and split on it. Handles the
// simple quoted-field case ("a,b") so a comma inside a name doesn't split it.
function splitDelimited(line, delim) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const clean = text.replace(/^﻿/, ''); // strip UTF-8 BOM Excel prepends
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((l) => splitDelimited(l, delim));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const ci = {
    name: col('name'),
    category: col('category'),
    unit: col('unit'),
    cost: col('cost'),
    sale: header.indexOf('saleprice') >= 0 ? header.indexOf('saleprice') : col('sale price'),
    qty: col('qty'),
    barcode: col('barcode'),
    tags: col('tags'),
    note: col('note'),
  };
  if (ci.name < 0 || ci.qty < 0 || ci.cost < 0) {
    throw new Error(`CSV missing required column(s). header=${header.join('|')}`);
  }
  const at = (r, i) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const num = (s) => {
    const n = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  return rows.slice(1).map((r) => ({
    name: at(r, ci.name),
    category: at(r, ci.category) || null,
    unit: at(r, ci.unit) || 'piece',
    costMinor: Math.round(num(at(r, ci.cost)) * MINOR),
    saleMinor: Math.round(num(at(r, ci.sale)) * MINOR),
    qty: Math.round(num(at(r, ci.qty))),
    barcode: at(r, ci.barcode) || null,
    tags: at(r, ci.tags) || null,
    note: at(r, ci.note) || null,
  })).filter((it) => it.name !== '');
}

if (!existsSync(IN)) throw new Error(`input CSV not found: ${IN}`);
const items = parseCsv(readFileSync(IN, 'utf8'));

// --- default categories (mirror src/db/seed.ts DEFAULT_CATEGORIES) -------
const DEFAULT_CATEGORIES = [
  ['tshirts', 'emerald', 'tshirts'],
  ['shoes', 'amber', 'shoes'],
  ['pants', 'violet', 'pants'],
  ['shirts', 'sky', 'shirts'],
  ['winterwear', 'blue', 'winterwear'],
  ['childrenwear', 'orange', 'childrenwear'],
  ['underwear', 'rose', 'underwear'],
  ['shirt', 'blue', 'shirt'],
  ['assets', 'pink', 'assets'],
  ['other', 'slate', 'other'],
];

// --- build the database (fresh: never append to a stale file) ------------
if (existsSync(OUT)) rmSync(OUT);
const db = new Database(OUT);
db.pragma('journal_mode = DELETE');
db.exec(ddl);

const insertMany = db.transaction(() => {
  // categories
  const catStmt = db.prepare(
    `INSERT OR IGNORE INTO categories (id, created_at, updated_at, deleted_at, name, color, icon, i18n_key, sort_order)
     VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
  );
  DEFAULT_CATEGORIES.forEach(([name, color, key], i) =>
    catStmt.run(randomUUID(), NOW, NOW, name, color, key, i),
  );

  // items
  const itemStmt = db.prepare(
    `INSERT INTO items (id, created_at, updated_at, deleted_at, name, category, barcode, unit,
       cost_price, sale_price, currency, pricing_mode, min_price, low_stock_threshold, photo_uri)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'EGP', 'fixed', NULL, 0, NULL)`,
  );
  const withId = items.map((it) => ({ ...it, id: randomUUID() }));
  for (const it of withId) {
    itemStmt.run(it.id, NOW, NOW, it.name, it.category, it.barcode, it.unit, it.costMinor, it.saleMinor);
  }

  // opening-stock document (posted incoming, walk-in sentinel supplier, no payment)
  const stocked = withId.filter((it) => it.qty > 0);
  const total = stocked.reduce((s, it) => s + Math.round(it.qty * it.costMinor), 0);
  const docId = randomUUID();
  db.prepare(
    `INSERT INTO documents (id, created_at, updated_at, deleted_at, kind, direction, status,
       doc_no, doc_date, total_amount, posted_at, party_id, note, attachments)
     VALUES (?, ?, ?, NULL, 'in', 1, 'posted', 'IN-000001', ?, ?, ?, 'system-walkin-supplier', ?, NULL)`,
  ).run(docId, NOW, NOW, NOW, total, NOW, 'رصيد افتتاحي');

  const lineStmt = db.prepare(
    `INSERT INTO document_lines (id, created_at, updated_at, deleted_at, document_id, item_id, qty, unit_price, list_price)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL)`,
  );
  const stockStmt = db.prepare(
    `INSERT INTO stock_levels (item_id, qty_on_hand, updated_at) VALUES (?, ?, ?)`,
  );
  for (const it of stocked) {
    lineStmt.run(randomUUID(), NOW, NOW, docId, it.id, it.qty, it.costMinor);
    stockStmt.run(it.id, it.qty, NOW);
  }

  // opening drawer — owner capital injection, +cash
  db.prepare(
    `INSERT INTO transactions (id, created_at, updated_at, deleted_at, direction, amount, occurred_at,
       account, ref_kind, ref_id, doc_id, note, attachments)
     VALUES (?, ?, ?, NULL, 1, ?, ?, 'cash', 'owner', NULL, NULL, ?, NULL)`,
  ).run(randomUUID(), NOW, NOW, OPENING_CASH_MAJOR * MINOR, NOW, 'رأس المال - النقدية الافتتاحية');

  return { itemCount: withId.length, stockedCount: stocked.length, total };
});

const stats = insertMany();

// --- backup_meta + version stamp -----------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS backup_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR REPLACE INTO backup_meta (key, value) VALUES
  ('format', '${FORMAT}'),
  ('format_version', '${FORMAT_VERSION}'),
  ('app_schema_version', '${APP_SCHEMA_VERSION}'),
  ('created_at', '${NOW}'),
  ('attachment_count', '0');
`);
db.pragma(`user_version = ${APP_SCHEMA_VERSION}`);
db.exec('VACUUM;');
db.close();

// --- report --------------------------------------------------------------
console.log(`wrote ${OUT}`);
console.log(`  items        ${stats.itemCount}`);
console.log(`  with stock   ${stats.stockedCount}`);
console.log(`  opening cost ${(stats.total / MINOR).toLocaleString()} EGP`);
console.log(`  cash drawer  ${OPENING_CASH_MAJOR.toLocaleString()} EGP`);
console.log(`  schema ver   ${APP_SCHEMA_VERSION}`);
