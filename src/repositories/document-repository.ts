import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import { lineTotal } from '@/utils/money';
import {
  IN,
  OUT,
  negativeStockViolations,
  type Direction,
  type PostingDoc,
} from '@/features/inventory/posting';

// Injectable so the same code runs on expo-sqlite (prod) and better-sqlite3
// (tests). Any sync Drizzle SQLite db with our schema satisfies this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export type DocKind = 'incoming' | 'outgoing';

/** Attachment metadata stored on the document (JSON). Bytes live in attachments.db. */
export interface AttachmentMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface DocumentLineInput {
  itemId: string;
  qty: number; // > 0 magnitude
  unitPrice?: number; // minor units; default 0 — what it actually sold for
  // The item's list price when the line was written (minor units). Sales only;
  // null on purchases. unitPrice < listPrice ⇒ a discount was given.
  listPrice?: number | null;
  title?: string | null; // fast-entry: typed product title for this line
  note?: string | null;
  imageUri?: string | null;
}

export interface CreateDocumentInput {
  kind: DocKind;
  lines: DocumentLineInput[];
  docDate?: number;
  note?: string;
  partyId?: string | null; // suppliers.id (incoming) / customers.id (outgoing); null = walk-in
  attachments?: AttachmentMeta[]; // receipt metadata; bytes already in attachments.db
  status?: 'draft' | 'posted'; // default 'draft'
}

/** One posted ledger movement for an item, with running balance + source doc. */
export interface MovementEntry {
  documentId: string;
  docNo: string | null;
  docDate: number | null;
  kind: DocKind;
  direction: Direction;
  qty: number;
  unitPrice: number; // minor units
  signedQty: number;
  runningBalance: number;
}

export interface PostOptions {
  allowNegative?: boolean;
}

/** Thrown when posting an outgoing doc would overdraw stock. */
export class NegativeStockError extends Error {
  constructor(
    public readonly violations: { itemId: string; available: number; requested: number }[],
  ) {
    super(`Insufficient stock for ${violations.length} item(s)`);
    this.name = 'NegativeStockError';
  }
}

const directionFor = (kind: DocKind): Direction => (kind === 'incoming' ? IN : OUT);

export function createDocumentRepository(db: DocDb) {
  /** Recompute cached on-hand for the given items from posted, live lines. */
  function recomputeStock(itemIds: string[]): void {
    if (itemIds.length === 0) return;
    const rows = db
      .select({
        itemId: schema.documentLines.itemId,
        qty: schema.documentLines.qty,
        direction: schema.documents.direction,
      })
      .from(schema.documentLines)
      .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLines.documentId))
      .where(
        and(
          inArray(schema.documentLines.itemId, itemIds),
          eq(schema.documents.status, 'posted'),
          isNull(schema.documents.deletedAt),
          isNull(schema.documentLines.deletedAt),
        ),
      )
      .all();

    const totals = new Map<string, number>(itemIds.map((id) => [id, 0]));
    for (const r of rows) {
      totals.set(r.itemId, (totals.get(r.itemId) ?? 0) + r.qty * r.direction);
    }
    const ts = now();
    for (const [itemId, qtyOnHand] of totals) {
      db.insert(schema.stockLevels)
        .values({ itemId, qtyOnHand, updatedAt: ts })
        .onConflictDoUpdate({
          target: schema.stockLevels.itemId,
          set: { qtyOnHand, updatedAt: ts },
        })
        .run();
    }
  }

  function nextDocNo(kind: DocKind): string {
    const prefix = kind === 'incoming' ? 'IN' : 'OUT';
    const count = db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.kind, kind === 'incoming' ? 'in' : 'out'))
      .all().length;
    return `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }

  function insertDraft(input: CreateDocumentInput): string {
    const ts = now();
    const id = newId();
    const direction = directionFor(input.kind);
    const total = input.lines.reduce(
      (sum, l) => sum + lineTotal(l.qty, l.unitPrice ?? 0),
      0,
    );
    db.insert(schema.documents)
      .values({
        id,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        kind: input.kind === 'incoming' ? 'in' : 'out',
        direction,
        status: 'draft',
        docNo: nextDocNo(input.kind),
        docDate: input.docDate ?? ts,
        totalAmount: total,
        postedAt: null,
        partyId: input.partyId ?? null,
        note: input.note ?? null,
        attachments: input.attachments?.length ? JSON.stringify(input.attachments) : null,
      })
      .run();
    for (const l of input.lines) {
      db.insert(schema.documentLines)
        .values({
          id: newId(),
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
          documentId: id,
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice ?? 0,
          listPrice: l.listPrice ?? null,
          title: l.title ?? null,
          note: l.note ?? null,
          imageUri: l.imageUri ?? null,
        })
        .run();
    }
    return id;
  }

  function parseAttachments(raw: string | null): AttachmentMeta[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AttachmentMeta[]) : [];
    } catch {
      return [];
    }
  }

  /** Resolve the counterparty name from its FK, keyed off the doc kind. */
  function partyNameFor(kind: string, partyId: string): string | null {
    const table = kind === 'in' ? schema.suppliers : schema.customers;
    const row = db.select({ name: table.name }).from(table).where(eq(table.id, partyId)).get();
    return row?.name ?? null;
  }

  function affectedItemIds(docId: string): string[] {
    const rows = db
      .select({ itemId: schema.documentLines.itemId })
      .from(schema.documentLines)
      .where(eq(schema.documentLines.documentId, docId))
      .all();
    return [...new Set(rows.map((r) => r.itemId))];
  }

  // Post body WITHOUT its own transaction, so it can run either standalone
  // (public `post`, wrapped below) or inside `create`'s transaction. The
  // expo-sqlite sync driver does not nest transactions via savepoints — a
  // BEGIN inside a BEGIN throws "Failed to run the query 'begin'".
  function postInternal(id: string, opts: PostOptions = {}): void {
    const doc = db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .get();
    if (!doc) throw new Error(`Document ${id} not found`);
    if (doc.status === 'posted') return;

    const lines = db
      .select()
      .from(schema.documentLines)
      .where(
        and(
          eq(schema.documentLines.documentId, id),
          isNull(schema.documentLines.deletedAt),
        ),
      )
      .all();

    if (doc.direction === OUT) {
      const itemIds = [...new Set(lines.map((l) => l.itemId))];
      const currentOnHand: Record<string, number> = {};
      for (const itemId of itemIds) currentOnHand[itemId] = api.onHand(itemId);
      const posting: PostingDoc = {
        status: 'posted',
        direction: OUT,
        lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      };
      const violations = negativeStockViolations(
        currentOnHand,
        posting,
        opts.allowNegative ?? false,
      );
      if (violations.length > 0) throw new NegativeStockError(violations);
    }

    const ts = now();
    db.update(schema.documents)
      .set({ status: 'posted', postedAt: ts, updatedAt: ts })
      .where(eq(schema.documents.id, id))
      .run();
    recomputeStock(affectedItemIds(id));
  }

  const api = {
    /** Create a draft (default) or post immediately (status: 'posted'). */
    create(input: CreateDocumentInput, opts: PostOptions = {}): string {
      return db.transaction(() => {
        const id = insertDraft(input);
        if (input.status === 'posted') postInternal(id, opts);
        return id;
      });
    },

    /** Materialize a draft into stock. Outgoing docs are stock-guarded. */
    post(id: string, opts: PostOptions = {}): void {
      db.transaction(() => postInternal(id, opts));
    },

    /** Revert a posted doc to draft; stock re-derives without it. */
    unpost(id: string): void {
      db.transaction(() => {
        const ts = now();
        db.update(schema.documents)
          .set({ status: 'draft', postedAt: null, updatedAt: ts })
          .where(eq(schema.documents.id, id))
          .run();
        recomputeStock(affectedItemIds(id));
      });
    },

    /** Soft-delete a doc; its stock effect disappears (archive, never hard-delete). */
    remove(id: string): void {
      db.transaction(() => {
        const items = affectedItemIds(id);
        const ts = now();
        db.update(schema.documents)
          .set({ deletedAt: ts, updatedAt: ts })
          .where(eq(schema.documents.id, id))
          .run();
        recomputeStock(items);
      });
    },

    /** Cached on-hand for one item (0 when never moved). */
    onHand(itemId: string): number {
      const row = db
        .select({ qty: schema.stockLevels.qtyOnHand })
        .from(schema.stockLevels)
        .where(eq(schema.stockLevels.itemId, itemId))
        .get();
      return row?.qty ?? 0;
    },

    getWithLines(id: string) {
      const doc = db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, id))
        .get();
      if (!doc) return null;
      const lines = db
        .select()
        .from(schema.documentLines)
        .where(
          and(
            eq(schema.documentLines.documentId, id),
            isNull(schema.documentLines.deletedAt),
          ),
        )
        .all();
      const attachments = parseAttachments(doc.attachments);
      const partyName = doc.partyId ? partyNameFor(doc.kind, doc.partyId) : null;
      return { ...doc, lines, attachments, partyName };
    },

    /**
     * Chronological posted movement for one item with a cumulative running
     * balance. Oldest first (by doc date, then creation). Each row carries its
     * source document so the movement screen can tap through. Final
     * runningBalance equals `onHand(itemId)`.
     */
    movement(itemId: string): MovementEntry[] {
      const rows = db
        .select({
          documentId: schema.documents.id,
          docNo: schema.documents.docNo,
          docDate: schema.documents.docDate,
          direction: schema.documents.direction,
          kind: schema.documents.kind,
          qty: schema.documentLines.qty,
          unitPrice: schema.documentLines.unitPrice,
        })
        .from(schema.documentLines)
        .innerJoin(schema.documents, eq(schema.documents.id, schema.documentLines.documentId))
        .where(
          and(
            eq(schema.documentLines.itemId, itemId),
            eq(schema.documents.status, 'posted'),
            isNull(schema.documents.deletedAt),
            isNull(schema.documentLines.deletedAt),
          ),
        )
        .orderBy(asc(schema.documents.docDate), asc(schema.documents.createdAt))
        .all();

      let balance = 0;
      return rows.map((r) => {
        const direction = r.direction as Direction;
        const signed = r.qty * direction;
        balance += signed;
        return {
          documentId: r.documentId,
          docNo: r.docNo,
          docDate: r.docDate,
          kind: r.kind === 'in' ? ('incoming' as const) : ('outgoing' as const),
          direction,
          qty: r.qty,
          unitPrice: r.unitPrice,
          signedQty: signed,
          runningBalance: balance,
        };
      });
    },

    list(filter: { kind?: DocKind; status?: 'draft' | 'posted' } = {}) {
      const conds = [isNull(schema.documents.deletedAt)];
      if (filter.kind) conds.push(eq(schema.documents.kind, filter.kind === 'incoming' ? 'in' : 'out'));
      if (filter.status) conds.push(eq(schema.documents.status, filter.status));
      return db.select().from(schema.documents).where(and(...conds)).all();
    },
  };

  return api;
}

export type DocumentRepository = ReturnType<typeof createDocumentRepository>;
