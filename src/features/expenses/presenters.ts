import type { TFunction } from 'i18next';
import type { ExpenseDebt } from '@/repositories/expense-repository';
import { fromMinor } from '@/utils/money';
import { formatMoneyMajor } from '@/utils/numerals';
import { formatDate } from '@/utils/dates';
import { metaFor } from './category-meta';

/**
 * Money → "٢٠٬٠٠٠٫٠٠ ج.م". The one place minor units become something readable.
 * Keeps the piastres: money is never rounded to whole pounds anywhere.
 */
export function money(minor: number, t: TFunction, lang: string): string {
  return `${formatMoneyMajor(fromMinor(Math.abs(minor)), lang)} ${t('common.currency')}`;
}

/** One expense row, ready to render. All formatting happens HERE, not in JSX. */
export interface ExpenseViewModel {
  id: string;
  title: string;
  /** "٧ يوليو · إيجار · الحاج مصطفى" */
  subtitle: string;
  amountLabel: string;
  /** "مسددة" | "سداد جزئي" | "غير مسددة" — derived, never a stored flag. */
  statusLabel: string;
  status: ExpenseDebt['status'];
  /** "باقي ١٥٬٠٠٠" — only while something is still owed on it. */
  remainingLabel: string | null;
  /** Settled bills need no سداد button. */
  settled: boolean;
  /** What the سداد sheet should pre-fill: the outstanding remainder. */
  suggestedAmount: number;
  icon: ReturnType<typeof metaFor>;
}

export function presentExpense(e: ExpenseDebt, t: TFunction, lang: string): ExpenseViewModel {
  const categoryLabel = e.category ? t(`expenses.filters.${e.category}`) : null;
  const subtitle = [formatDate(e.incurredAt, lang), categoryLabel, e.partyName]
    .filter(Boolean)
    .join(' · ');

  return {
    id: e.id,
    title: e.title,
    subtitle,
    amountLabel: money(e.totalAmount, t, lang),
    statusLabel: t(`expenses.status.${e.status}`),
    status: e.status,
    // An over-paid expense has a NEGATIVE remainder; it owes nothing, so it says
    // nothing. (The credit is visible in the cash book, where the money went.)
    remainingLabel:
      e.remaining > 0 ? t('debts.remainingOf', { amount: money(e.remaining, t, lang) }) : null,
    settled: e.remaining <= 0,
    suggestedAmount: Math.max(0, e.remaining),
    icon: metaFor(e.category),
  };
}
