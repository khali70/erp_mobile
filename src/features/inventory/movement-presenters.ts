import type { TFunction } from 'i18next';
import type { MovementEntry } from '@/repositories/document-repository';
import { toArabicDigits, formatDay } from '@/utils/numerals';
import { formatMoney } from '@/utils/money';

/** Display-ready movement row consumed by <MovementRow>. */
export interface MovementRowViewModel {
  documentId: string;
  docLabel: string;
  dateLabel: string;
  isIncoming: boolean;
  directionLabel: string;
  qtyLabel: string; // signed magnitude with +/− and unit
  amountLabel: string;
  balanceLabel: string;
}

/** Map one ledger entry to its display view-model (RTL-safe, shaped digits). */
export function presentMovement(
  entry: MovementEntry,
  unitLabel: string,
  t: TFunction,
  lang: string,
): MovementRowViewModel {
  const isIncoming = entry.direction === 1;
  const sign = isIncoming ? '+' : '−';
  const qty = toArabicDigits(entry.qty);
  return {
    documentId: entry.documentId,
    docLabel: entry.docNo ?? t('inventory.movement.untitled'),
    dateLabel: entry.docDate != null ? formatDay(entry.docDate, lang) : '',
    isIncoming,
    directionLabel: t(isIncoming ? 'inventory.movement.in' : 'inventory.movement.out'),
    qtyLabel: `${sign}${qty} ${unitLabel}`,
    amountLabel: formatMoney(entry.qty * entry.unitPrice),
    balanceLabel: `${toArabicDigits(entry.runningBalance)} ${unitLabel}`,
  };
}
