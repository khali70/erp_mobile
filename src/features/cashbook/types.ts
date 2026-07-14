import type { AttachmentMeta } from '@/repositories/document-repository';
import type { Account, TxDirection } from '@/repositories/transaction-repository';

/**
 * WHY the money moved, as the ledger renders it.
 *
 * `'unknown'` exists because a row whose `ref_kind` is null or unrecognised is
 * still MONEY THAT MOVED. It must appear in the book and in the balance, even if
 * the app cannot say why — a ledger that silently drops rows it does not
 * understand is exactly the hole this epic exists to close.
 */
export type LedgerKind =
  | 'supplier'
  | 'expense'
  | 'sale'
  | 'owner'
  | 'transfer'
  | 'other'
  | 'unknown';

/**
 * One line of the cash book.
 *
 * A TRANSFER is ONE entry built from TWO transaction rows (out of one pocket,
 * into the other). Rendering it as two unrelated movements would make the owner
 * read a 5000 transfer as 5000 gone and 5000 arrived from nowhere — and a
 * transfer is neither income nor expense, it is the same money in another
 * pocket. Hence `direction: null` for a transfer: it has no sign.
 */
export interface LedgerEntry {
  /** The row's id — for a transfer, the id of its OUT leg. */
  id: string;
  kind: LedgerKind;
  occurredAt: number;
  /** Minor units, always positive. The sign lives in `direction`. */
  amount: number;
  /** null ⇒ a transfer: neither in nor out. */
  direction: TxDirection | null;
  /** The pocket the money moved through — for a transfer, the SOURCE pocket. */
  account: Account;
  /** Transfer destination; null for everything else. */
  toAccount: Account | null;
  refId: string | null;
  note: string | null;
  /** PROOF OF MONEY — the InstaPay screenshot, when there is one. */
  attachments: AttachmentMeta[];
}

/**
 * One day of the cash book, with what each pocket did that day.
 *
 * `netCash` / `netInstapay` are the day's CHANGE in each pocket, summed from the
 * raw rows (both legs of a transfer included) — so a drawer→InstaPay transfer
 * shows −5000 / +5000 and nets to zero across the two, which is the truth of it.
 */
export interface LedgerDay {
  /** Epoch ms of the day's first instant, in the shop's LOCAL timezone. */
  key: number;
  entries: LedgerEntry[];
  netCash: number;
  netInstapay: number;
}

/** What the record-a-movement sheet can record. */
export type MovementType = 'drawing' | 'injection' | 'transfer' | 'other';

/** The sheet's working state. `amount` is as TYPED (major units) until save. */
export interface MovementDraft {
  type: MovementType;
  amount: string;
  /** The pocket touched — the SOURCE pocket for a transfer. */
  account: Account;
  /** Only meaningful for `'other'`: is this money in or out? */
  direction: TxDirection;
  /** When the money MOVED. */
  occurredAt: number;
  note: string;
  /** PROOF OF MONEY. Only ever collected for InstaPay. */
  proof: AttachmentMeta[];
}
