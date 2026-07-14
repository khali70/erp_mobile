import type { TFunction } from 'i18next';
import type {
  DebtPayment,
  InvoiceSettlement,
  SupplierDebt,
} from '@/repositories/debt-repository';
import type { ExpenseDebt } from '@/repositories/expense-repository';
import { fromMinor } from '@/utils/money';
import { formatMoneyMajor, formatNumber } from '@/utils/numerals';
import { formatDate } from '@/utils/dates';

/**
 * Money → "٤٬٠٠٠٫٠٠ ج.م". The one place minor units become something readable.
 *
 * MAGNITUDE: a credit is titled "رصيد لك" and shown as a positive figure, which
 * is why the abs is deliberate here. `formatNumber` is for COUNTS only — it
 * rounds, and rounding a debt of 0.50 to "٠" is not a rounding error.
 */
function money(minor: number, t: TFunction, lang: string): string {
  return `${formatMoneyMajor(fromMinor(Math.abs(minor)), lang)} ${t('common.currency')}`;
}

/** A row of the debts list. */
export interface SupplierDebtViewModel {
  id: string;
  name: string;
  initial: string;
  phoneLabel: string;
  owedLabel: string;
  /** "منذ ٤٥ يوم" — how long the oldest unpaid invoice has been outstanding. */
  ageLabel: string;
  /** Old debt earns a louder color. The owner should feel the 45-day one. */
  overdue: boolean;
}

/** Debt older than this reads as a problem, not a fact of business. */
const OVERDUE_DAYS = 30;

export function presentSupplierDebt(
  row: SupplierDebt,
  t: TFunction,
  lang: string,
): SupplierDebtViewModel {
  return {
    id: row.id,
    name: row.name,
    initial: row.name.trim().charAt(0),
    phoneLabel: row.phone ?? t('parties.noPhone'),
    owedLabel: money(row.owed, t, lang),
    ageLabel:
      row.ageDays === 0
        ? t('debts.ageToday')
        : t('debts.age', { days: formatNumber(row.ageDays, lang) }),
    overdue: row.ageDays >= OVERDUE_DAYS,
  };
}

/** One invoice line on the detail screen — the FIFO walk, made readable. */
export interface SettlementViewModel {
  id: string;
  /** "IN-000012" */
  docNoLabel: string;
  dateLabel: string;
  totalLabel: string;
  /** "سُدّدت بالكامل" | "سداد جزئي" | "لم تُسدَّد". Never the word "allocation". */
  statusLabel: string;
  status: InvoiceSettlement['status'];
  /** "باقي ١٠" — only when something is still owed on this invoice. */
  remainingLabel: string | null;
  /** How much of this invoice the payments covered; null when none of it. */
  paidLabel: string | null;
}

export function presentSettlement(
  s: InvoiceSettlement,
  t: TFunction,
  lang: string,
): SettlementViewModel {
  return {
    id: s.documentId,
    docNoLabel: s.docNo ?? t('debts.noDocNo'),
    dateLabel: formatDate(s.docDate, lang),
    totalLabel: money(s.total, t, lang),
    statusLabel: t(`debts.status.${s.status}`),
    status: s.status,
    remainingLabel:
      s.remaining > 0 ? t('debts.remainingOf', { amount: money(s.remaining, t, lang) }) : null,
    paidLabel: s.paid > 0 ? money(s.paid, t, lang) : null,
  };
}

/** One row of the payment history. */
export interface PaymentViewModel {
  id: string;
  dateLabel: string;
  amountLabel: string;
  /**
   * WHICH POCKET — or, for an opening adjustment, that there was none.
   *
   * An opening row settles debt without ever touching the cash book, so labelling
   * it "نقدي" would send the owner looking for it in a drawer it never came out
   * of. It says «دفعة قديمة» instead: the same chip, telling the truth.
   */
  accountLabel: string;
  /** TRUE ⇒ money that moved BEFORE the app existed. Not in the cash book, by design. */
  isOpening: boolean;
  note: string | null;
  /** Proof of MONEY — an InstaPay screenshot, when there is one to show. */
  proof: DebtPayment['attachments'];
}

export function presentPayment(p: DebtPayment, t: TFunction, lang: string): PaymentViewModel {
  return {
    id: p.id,
    dateLabel: formatDate(p.occurredAt, lang),
    amountLabel: money(p.amount, t, lang),
    accountLabel: p.isOpening
      ? t('payments.opening.badge')
      : t(`payments.accounts.${p.account}`),
    isOpening: p.isOpening,
    note: p.note,
    proof: p.attachments,
  };
}

/**
 * An unpaid bill, shown on the DEBTS screen next to the suppliers.
 *
 * It belongs there because the owner's real question is "WHAT DO I OWE", and the
 * suppliers are only one slice of the answer. Rent with no goods and no invoice
 * is an obligation exactly like a purchase on credit — and a debts screen that
 * omits it is answering a narrower question than the one he asked.
 */
export interface UnpaidExpenseViewModel {
  id: string;
  title: string;
  /** "٧ يوليو · إيجار · الحاج مصطفى" */
  subtitle: string;
  /** What is STILL owed on it — not what it cost. */
  remainingLabel: string;
  /** True once part of it has been paid ("سداد جزئي"). */
  partial: boolean;
  partialLabel: string | null;
}

export function presentUnpaidExpense(
  e: ExpenseDebt,
  t: TFunction,
  lang: string,
): UnpaidExpenseViewModel {
  const categoryLabel = e.category ? t(`expenses.filters.${e.category}`) : null;
  return {
    id: e.id,
    title: e.title,
    subtitle: [formatDate(e.incurredAt, lang), categoryLabel, e.partyName]
      .filter(Boolean)
      .join(' · '),
    remainingLabel: money(e.remaining, t, lang),
    partial: e.status === 'partial',
    // "من أصل ٢٠٬٠٠٠" — the bill was bigger; some of it is already paid.
    partialLabel:
      e.status === 'partial'
        ? t('debts.outOfTotal', { amount: money(e.totalAmount, t, lang) })
        : null,
  };
}

/** The supplier's bottom line. */
export interface BalanceViewModel {
  /** "المستحق" or "رصيد لك" — a credit is NOT a debt and must not read as one. */
  title: string;
  amountLabel: string;
  isCredit: boolean;
  isSettled: boolean;
}

/**
 * Three states, not two. A NEGATIVE balance is a CREDIT: the shop paid more than
 * it owed, so the supplier owes it back (رصيد لك). Flattening that into "settled"
 * would quietly write off the owner's own money.
 */
export function presentBalance(owed: number, t: TFunction, lang: string): BalanceViewModel {
  const isCredit = owed < 0;
  return {
    title: isCredit ? t('debts.credit') : t('debts.owed'),
    amountLabel: money(owed, t, lang),
    isCredit,
    isSettled: owed === 0,
  };
}
