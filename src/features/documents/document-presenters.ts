import type { TFunction } from 'i18next';
import { formatMoney } from '@/utils/money';
import { formatDay } from '@/utils/numerals';
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
