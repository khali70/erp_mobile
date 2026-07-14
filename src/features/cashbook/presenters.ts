import type { TFunction } from 'i18next';
import type { AttachmentMeta } from '@/repositories/document-repository';
import { fromMinor } from '@/utils/money';
import { formatNumber } from '@/utils/numerals';
import { formatDate, isSameDay } from '@/utils/dates';
import type { LedgerDay, LedgerEntry } from './types';

/** Money → "٥٬٠٠٠ ج.م". The one place minor units become something readable. */
export function money(minor: number, t: TFunction, lang: string): string {
  return `${formatNumber(fromMinor(Math.abs(minor)), lang)} ${t('common.currency')}`;
}

/** Money with its sign made explicit: "+ ٥٬٠٠٠ ج.م" / "− ٥٬٠٠٠ ج.م". */
export function signedMoney(minor: number, t: TFunction, lang: string): string {
  return `${minor < 0 ? '−' : '+'} ${money(minor, t, lang)}`;
}

/** A movement's tone. A transfer is neutral — it is neither a gain nor a loss. */
export type LedgerTone = 'in' | 'out' | 'neutral';

/** One rendered line of the cash book. All formatting happens HERE, not in JSX. */
export interface LedgerEntryViewModel {
  id: string;
  /** WHY the money moved: "سداد لمورد" · "بيع" · "سحب شخصي" · "تحويل". */
  title: string;
  /** "نقدي" — or, for a transfer, "من النقدي إلى إنستاباي". */
  subtitle: string;
  note: string | null;
  /** "+ ١٠٬٠٠٠ ج.م" — a transfer carries no sign. */
  amountLabel: string;
  tone: LedgerTone;
  icon: 'arrow-down-left' | 'arrow-up-right' | 'repeat';
  /** Proof of MONEY, when the payment carried a screenshot. */
  proof: AttachmentMeta[];
}

const ICONS: Record<LedgerTone, LedgerEntryViewModel['icon']> = {
  in: 'arrow-down-left',
  out: 'arrow-up-right',
  neutral: 'repeat',
};

/**
 * WHY the money moved, in the owner's words.
 *
 * `owner` splits on direction, because "المالك" is two opposite events: money
 * taken OUT of the drawer for lunch, and money put IN from his own pocket.
 * Labelling both the same would make the ledger unreadable exactly where it
 * matters most.
 */
function titleFor(entry: LedgerEntry, t: TFunction): string {
  if (entry.kind === 'owner') {
    return t(entry.direction === -1 ? 'cashbook.kinds.drawing' : 'cashbook.kinds.injection');
  }
  return t(`cashbook.kinds.${entry.kind}`);
}

export function presentEntry(
  entry: LedgerEntry,
  t: TFunction,
  lang: string,
): LedgerEntryViewModel {
  const isTransfer = entry.kind === 'transfer';
  const tone: LedgerTone = isTransfer ? 'neutral' : entry.direction === 1 ? 'in' : 'out';

  const subtitle =
    isTransfer && entry.toAccount
      ? t('cashbook.transferRoute', {
          from: t(`payments.accounts.${entry.account}`),
          to: t(`payments.accounts.${entry.toAccount}`),
        })
      : t(`payments.accounts.${entry.account}`);

  return {
    id: entry.id,
    title: titleFor(entry, t),
    subtitle,
    note: entry.note,
    // A transfer has no sign: it is the same money in a different pocket, and
    // showing it as "−5000" would read as a loss on every single one.
    amountLabel: isTransfer
      ? money(entry.amount, t, lang)
      : signedMoney(entry.amount * (entry.direction ?? 1), t, lang),
    tone,
    icon: ICONS[tone],
    proof: entry.attachments,
  };
}

/** The header of one day in the ledger, with what each pocket did that day. */
export interface LedgerDayViewModel {
  key: number;
  /** "اليوم" or "١٢/٠٧/٢٠٢٦". */
  dateLabel: string;
  /** "نقدي + ٦٬٠٠٠ ج.م" — the day's change in the drawer. */
  cashLabel: string;
  cashUp: boolean;
  instapayLabel: string;
  instapayUp: boolean;
}

export function presentDay(
  day: LedgerDay,
  t: TFunction,
  lang: string,
  today: number,
): LedgerDayViewModel {
  return {
    key: day.key,
    dateLabel: isSameDay(day.key, today) ? t('payments.today') : formatDate(day.key, lang),
    cashLabel: signedMoney(day.netCash, t, lang),
    cashUp: day.netCash >= 0,
    instapayLabel: signedMoney(day.netInstapay, t, lang),
    instapayUp: day.netInstapay >= 0,
  };
}
