import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import { lineTotal } from '@/utils/money';
import { isSentinelId } from '@/db/sentinels';
import {
  archiveTransactionsForDocument,
  insertTransactionRow,
  NET_AMOUNT_SQL,
  type Account,
  type TxRefKind,
} from './transaction-repository';
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

/**
 * Money handed over AS PART OF saving this document.
 *
 * One entry per pocket the money came out of: paying 2000 cash + 1000 InstaPay
 * is TWO entries, hence two cash-book rows, each with its own proof. This is
 * exactly why a `paid_amount` column on the document is impossible — a single
 * number cannot say which screenshot proves which installment.
 *
 * Omit entirely (or pass []) to buy purely on debt: no money moved, so NO
 * transaction row is written and the cash book does not claim otherwise.
 */
export interface DocumentPaymentInput {
  /** Minor units, POSITIVE. The direction is implied by the document kind. */
  amount: number;
  account: Account;
  /** PROOF OF MONEY (the InstaPay screenshot) — lives on the payment, not the document. */
  attachments?: AttachmentMeta[];
  note?: string | null;
  /** When the money MOVED. Defaults to the document's date. */
  occurredAt?: number;
}

export interface CreateDocumentInput {
  kind: DocKind;
  lines: DocumentLineInput[];
  docDate?: number;
  note?: string;
  // suppliers.id (incoming) / customers.id (outgoing). Walk-ins resolve to a
  // SENTINEL party id, never null — see src/db/sentinels.ts.
  partyId?: string | null;
  attachments?: AttachmentMeta[]; // PROOF OF GOODS (the paper invoice); bytes in attachments.db
  status?: 'draft' | 'posted'; // default 'draft'
  /** What was actually handed over at delivery. See DocumentPaymentInput. */
  payments?: DocumentPaymentInput[];
}

/** Thrown when a document's payments are inconsistent with the document itself. */
export class InvalidPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaymentError';
  }
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

  /**
   * Write the cash-book rows for the money handed over with this document.
   *
   * CRITICALLY: this opens NO transaction of its own. It is only ever called
   * from inside `create`'s existing `db.transaction()`, via
   * `insertTransactionRow` (which is likewise transaction-free) — because
   * expo-sqlite's sync driver CANNOT NEST TRANSACTIONS and a `BEGIN` inside a
   * `BEGIN` throws. That constraint is also the feature: a payment that fails
   * to write rolls the document AND its lines back with it, so there can never
   * be an orphan invoice carrying a phantom debt.
   */
  function writePayments(
    docId: string,
    input: CreateDocumentInput,
    totalAmount: number,
    docDate: number,
  ): void {
    const payments = input.payments ?? [];
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);

    // THE SALES INVARIANT — checked BEFORE the "no money moved" early-out,
    // because for a sale "no money moved" is precisely the failure.
    //
    // Customer debt (AR) is deprecated and unbuilt: there is NO book that can
    // hold an unpaid sale. So `Σ transactions(ref_kind='sale', ref_id=doc)` MUST
    // equal the document total. A short-paid sale is REJECTED — accept it and
    // the difference simply vanishes: goods gone, money not in the drawer, and
    // nothing anywhere recording who owes it.
    //
    // If this ever proves wrong in the real shop, that is the signal to
    // UN-DEPRECATE AR. It is not a constraint to paper over.
    //
    // UNCONDITIONAL for a POSTED sale. It used to be skipped when `payments` was
    // omitted rather than empty — a distinction the invariant cannot survive:
    // `create({ kind: 'outgoing', status: 'posted' })` with no payments key
    // posted a sale with ZERO cash-book rows, goods gone and the money nowhere,
    // which is precisely the state the rule exists to forbid. Omitting the key
    // is not a licence to skip the check; it is the worst way to fail it.
    //
    // A DRAFT sale is exempt because a draft holds no money at all — and the
    // moment it stops being a draft, `post()` applies this same rule to it.
    // PURCHASES may legitimately omit payments (buying on debt, and seed.ts
    // relies on it): the debt book is there to hold the rest.
    if (input.kind === 'outgoing' && input.status === 'posted' && paid !== totalAmount) {
      throw new InvalidPaymentError(
        `A sale must be settled in full — there is no customer-debt book to hold the rest (paid ${paid} of ${totalAmount})`,
      );
    }

    if (payments.length === 0) return; // no money moved — write nothing

    // A draft is not an obligation and settles nothing; money against one is
    // incoherent, and it would land in the cash book while the debt it paid
    // stayed invisible (drafts are excluded from every derived figure).
    if (input.status !== 'posted') {
      throw new InvalidPaymentError('Cannot record a payment on a draft document');
    }

    if (paid < 0) throw new InvalidPaymentError(`Paid amount cannot be negative (got ${paid})`);
    // Over-paying at delivery is rejected: you cannot hand a man more than the
    // goods are worth *in the same breath as receiving them*. Paying more than
    // is owed is a real thing, but it happens LATER, from the debts screen, as a
    // standalone transaction — where it correctly becomes a credit.
    if (paid > totalAmount) {
      throw new InvalidPaymentError(
        `Paid (${paid}) exceeds the document total (${totalAmount})`,
      );
    }

    const partyId = input.partyId ?? null;
    if (!partyId) {
      throw new InvalidPaymentError('A payment needs a party to point at (walk-ins use a sentinel)');
    }

    // A SENTINEL MUST NEVER CARRY DEBT. Nobody can be chased for it — "بدون
    // مورد" is not a person you can go and pay. So a walk-in purchase has to be
    // settled in full, here, or not recorded at all.
    if (isSentinelId(partyId) && paid !== totalAmount) {
      throw new InvalidPaymentError(
        `A walk-in document must be paid in full (paid ${paid} of ${totalAmount})`,
      );
    }

    // A purchase pays money OUT to a supplier; a sale takes money IN against the
    // document itself (there is no AR book for a sale to be owed against).
    const isPurchase = input.kind === 'incoming';
    const direction: Direction = isPurchase ? OUT : IN;
    const refKind: TxRefKind = isPurchase ? 'supplier' : 'sale';
    const refId = isPurchase ? partyId : docId;

    for (const p of payments) {
      insertTransactionRow(db, {
        direction: direction === IN ? 1 : -1,
        amount: p.amount,
        // Money and paperwork are different clocks: the cash book follows when
        // the money MOVED, defaulting to the document's date only because at
        // delivery they are the same instant.
        occurredAt: p.occurredAt ?? docDate,
        account: p.account,
        refKind,
        refId,
        // PROVENANCE: this row was BORN WITH this document and must die with it
        // (`remove()`). It is NOT an allocation link — a purchase payment still
        // points at the SUPPLIER through `refId`, and the FIFO walk reads only
        // that. Money paid LATER through the سداد sheet carries no docId and
        // rightly survives the deletion of any invoice.
        docId,
        note: p.note ?? null,
        attachments: p.attachments,
      });
    }
  }

  /**
   * THE SALES INVARIANT, applied to the OTHER door into 'posted'.
   *
   * `create()` enforces it on the payments it is handed; `post()` is handed none
   * at all, and a draft sale by definition carries no money (a payment on a draft
   * is rejected outright). So posting one would have materialized a sale whose
   * goods left the shelf and whose money exists nowhere — the exact hole the
   * invariant forbids, reached by walking round it instead of through it.
   *
   * The figure is Σ(direction × amount) over the sale's live rows: a magnitude
   * sum would let a refund pose as a payment.
   */
  function assertSaleIsSettled(docId: string): void {
    const doc = db
      .select({
        kind: schema.documents.kind,
        totalAmount: schema.documents.totalAmount,
      })
      .from(schema.documents)
      .where(eq(schema.documents.id, docId))
      .get();
    if (!doc || doc.kind !== 'out') return;

    const row = db
      .select({ total: NET_AMOUNT_SQL })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.refKind, 'sale'),
          eq(schema.transactions.refId, docId),
          isNull(schema.transactions.deletedAt),
        ),
      )
      .get();
    const paid = row?.total ?? 0;
    if (paid !== doc.totalAmount) {
      throw new InvalidPaymentError(
        `A sale must be settled in full — there is no customer-debt book to hold the rest (paid ${paid} of ${doc.totalAmount})`,
      );
    }
  }

  const api = {
    /**
     * Create a draft (default) or post immediately (status: 'posted'), optionally
     * recording what was paid — document, lines, stock and cash book all in ONE
     * atomic transaction. Any failure rolls back every part of it.
     */
    create(input: CreateDocumentInput, opts: PostOptions = {}): string {
      return db.transaction(() => {
        const id = insertDraft(input);
        if (input.status === 'posted') postInternal(id, opts);
        const doc = db
          .select({ totalAmount: schema.documents.totalAmount, docDate: schema.documents.docDate })
          .from(schema.documents)
          .where(eq(schema.documents.id, id))
          .get();
        writePayments(id, input, doc?.totalAmount ?? 0, doc?.docDate ?? now());
        return id;
      });
    },

    /**
     * Materialize a draft into stock. Outgoing docs are stock-guarded — and
     * MONEY-guarded: a sale cannot post unless its full price is in the cash
     * book, because there is no customer-debt book to hold the remainder.
     */
    post(id: string, opts: PostOptions = {}): void {
      db.transaction(() => {
        assertSaleIsSettled(id);
        postInternal(id, opts);
      });
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

    /**
     * Soft-delete a doc: its stock effect AND ITS MONEY both disappear, in one
     * atomic step (archive, never hard-delete).
     *
     * THE MONEY IS THE HALF THAT USED TO BE MISSING. Deleting the document alone
     * left every cash-book row it had written alive and counted, and the two
     * derived figures then contradicted the world:
     *
     *   • a part-paid PURCHASE — the 6000 invoice stops being invoiced, the 2000
     *     paid against it keeps being paid, and `owed(Ahmed)` = 0 − 2000 = −2000.
     *     The debts screen tells the owner "Ahmed owes YOU 2000": a phantom
     *     credit, against a man he never overpaid a piastre.
     *   • a SALE — the ref_kind='sale' rows stay in `balances()` and
     *     `salesBetween()`, so the drawer claims 10,000 that is not in it, and
     *     the day's takings include a sale that no longer exists.
     *
     * Only rows carrying this document's `doc_id` are touched — the money BORN
     * WITH it. A standalone سداد payment points at the supplier, carries no
     * doc_id, and survives: that money really did move, and deleting an invoice
     * cannot un-move it (it becomes a credit, which is the truth).
     */
    remove(id: string): void {
      db.transaction(() => {
        const items = affectedItemIds(id);
        const ts = now();
        db.update(schema.documents)
          .set({ deletedAt: ts, updatedAt: ts })
          .where(eq(schema.documents.id, id))
          .run();
        // Transaction-free by design: expo-sqlite's sync driver cannot nest a
        // BEGIN inside this BEGIN. Same reason `insertTransactionRow` exists.
        archiveTransactionsForDocument(db, id);
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
