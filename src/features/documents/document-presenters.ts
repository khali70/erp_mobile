import type { TFunction } from 'i18next';
import { formatMoney, lineTotal } from '@/utils/money';
import { formatDay } from '@/utils/numerals';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { DocumentRow } from './hooks/useDocuments';

export interface DocumentRowViewModel {
  id: string;
  /** 'in' = incoming (stock +), 'out' = outgoing (stock −). */
  kind: 'in' | 'out';
  docLabel: string;
  dateLabel: string;
  totalLabel: string;
  noteLabel: string | null;
}

/** Maps a raw document row to display strings (RTL/Arabic aware). */
export function presentDocument(row: DocumentRow, t: TFunction, lang: string): DocumentRowViewModel {
  const kind = row.kind === 'in' ? 'in' : 'out';
  const when = row.docDate ?? row.createdAt;
  return {
    id: row.id,
    kind,
    docLabel: row.docNo ?? t('documents.untitled'),
    dateLabel: formatDay(when, lang),
    totalLabel: formatMoney(row.totalAmount),
    noteLabel: row.note && row.note.trim() ? row.note : null,
  };
}

export interface DocumentLineViewModel {
  id: string;
  name: string;
  qty: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
  noteLabel: string | null;
}

export interface DocumentDetailViewModel {
  id: string;
  kind: 'in' | 'out';
  docLabel: string;
  dateLabel: string;
  kindLabel: string;
  /**
   * WHO the document is with — the id, not just the name.
   *
   * The name is for reading; the id is what the settlement is derived FROM. "Did
   * I pay IN-000012?" is a question about this supplier's whole book (invoices
   * minus payments, walked FIFO), and it cannot be asked without him.
   */
  partyId: string | null;
  partyLabel: string | null;
  noteLabel: string | null;
  attachments: AttachmentMeta[];
  lines: DocumentLineViewModel[];
  /** Report roll-up. */
  itemCount: number;
  totalQty: number;
  totalLabel: string;
}

/** Raw line + resolved item name → display strings. */
interface DetailLineInput {
  id: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  title: string | null;
  note: string | null;
  itemName: string | null;
}

interface DetailDocInput {
  id: string;
  kind: string;
  docNo: string | null;
  docDate: number | null;
  createdAt: number;
  totalAmount: number;
  partyId: string | null;
  partyName: string | null;
  note: string | null;
  attachments: AttachmentMeta[];
  lines: DetailLineInput[];
}

/** Maps a document with its lines to the detail/report view model. */
export function presentDocumentDetail(
  doc: DetailDocInput,
  t: TFunction,
  lang: string,
): DocumentDetailViewModel {
  const kind = doc.kind === 'in' ? 'in' : 'out';
  const when = doc.docDate ?? doc.createdAt;
  const lines: DocumentLineViewModel[] = doc.lines.map((l) => ({
    id: l.id,
    name: l.itemName ?? (l.title && l.title.trim() ? l.title : t('documents.detail.untitledItem')),
    qty: l.qty,
    unitPriceLabel: formatMoney(l.unitPrice),
    lineTotalLabel: formatMoney(lineTotal(l.qty, l.unitPrice)),
    noteLabel: l.note && l.note.trim() ? l.note : null,
  }));
  return {
    id: doc.id,
    kind,
    docLabel: doc.docNo ?? t('documents.untitled'),
    dateLabel: formatDay(when, lang),
    kindLabel: kind === 'in' ? t('documents.kind.incoming') : t('documents.kind.outgoing'),
    partyId: doc.partyId,
    partyLabel: doc.partyName && doc.partyName.trim() ? doc.partyName : null,
    noteLabel: doc.note && doc.note.trim() ? doc.note : null,
    attachments: doc.attachments,
    lines,
    itemCount: lines.length,
    totalQty: doc.lines.reduce((s, l) => s + l.qty, 0),
    totalLabel: formatMoney(doc.totalAmount),
  };
}
