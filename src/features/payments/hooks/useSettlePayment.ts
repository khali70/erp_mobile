import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fromMinor, toMajor, toMinor } from '@/utils/money';
import { formatMoneyMajor, normalizeDigits, toLocaleDigits } from '@/utils/numerals';
import { addDays } from '@/utils/dates';
import { ingest, pickPhoto, removeAttachment } from '@/utils/attachments';
import { transactionRepository } from '@/repositories/transaction-repository.client';
import { CASH, OPENING, type Account } from '@/repositories/transaction-repository';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { SettleDraft, SettleTarget } from '../types';

interface UseSettlePaymentArgs {
  /** What the money is paid against (supplier today, expense in Epic 3). */
  target: SettleTarget;
  visible: boolean;
  /** Pre-fills المبلغ, in MINOR units — normally the full outstanding balance. */
  suggestedAmount?: number;
  /** WHO is being paid ("أحمد", "إيجار المحل") — named back to him on save. */
  payeeName: string;
  /** Called after exactly one transaction row has been written. */
  onSaved: () => void;
}

const emptyDraft = (): SettleDraft => ({
  amount: '',
  account: CASH,
  occurredAt: Date.now(),
  note: '',
  proof: [],
  // OFF by default: the overwhelmingly common case is money moving right now,
  // at the counter, and a sheet that guesses "this is historical" would quietly
  // keep today's payments out of the cash book.
  isOpening: false,
});

/**
 * ALL the behaviour behind the سداد sheet: form state, proof capture, and the
 * single write.
 *
 * The write is ONE standalone `transactions` row — `direction: -1`, pointing at
 * the ref — with NO document involved. That is the entire feature: the invoice
 * closed days ago, the money moves today, and debt is the subtraction between
 * them. Nothing here allocates the payment to an invoice, because nothing in
 * this database can: the FIFO walk derives that at read time (debt-repository).
 *
 * OVER-PAYING IS ALLOWED, deliberately. Handing a man a round 4000 against 2500
 * owed is a normal thing to do; it simply drives `owed` negative, which reads as
 * a credit (رصيد لك). Clamping it here would silently lose 1500 of the owner's
 * money, and he would never find out where it went.
 */
export function useSettlePayment({
  target,
  visible,
  suggestedAmount,
  payeeName,
  onSaved,
}: UseSettlePaymentArgs) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<SettleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  /** Minor units → "٤٬٠٠٠٫٠٠ ج.م". Money NEVER reaches a string any other way. */
  const money = useCallback(
    (minor: number) =>
      `${formatMoneyMajor(fromMinor(Math.abs(minor)), i18n.language)} ${t('common.currency')}`,
    [i18n.language, t],
  );

  // Re-arm on every open: a fresh date (today, not whenever the screen mounted)
  // and the current outstanding balance, which the last payment just changed.
  useEffect(() => {
    if (!visible) return;
    setDraft({
      ...emptyDraft(),
      // Minor → major exactly once, through toMajor: a fixed-decimal "25.20",
      // never String(25.200000000000003) — and never a hardcoded /100.
      amount: suggestedAmount && suggestedAmount > 0 ? toMajor(suggestedAmount) : '',
    });
  }, [visible, suggestedAmount]);

  const set = useCallback(
    <K extends keyof SettleDraft>(key: K, value: SettleDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // `draft.amount` is CANONICAL (Latin digits, '.') so `toMinor` can parse it;
  // `amountValue` is the same number shaped for the screen. An Arabic-Indic
  // amount reaching toMinor would parse to 0 and the sheet would refuse to save
  // with nothing on screen explaining why.
  const setAmount = useCallback((amount: string) => set('amount', normalizeDigits(amount)), [set]);
  const setNote = useCallback((note: string) => set('note', note), [set]);

  // Leaving InstaPay DROPS the proof: `submit` only ever writes it on an InstaPay
  // payment, so keeping it would leave its bytes in attachments.db attached to
  // nothing while the owner still believes he filed it.
  const setAccount = useCallback((account: Account) => {
    setDraft((prev) => {
      if (account === 'instapay') return { ...prev, account };
      prev.proof.forEach((a) => removeAttachment(a.id));
      return { ...prev, account, proof: [] };
    });
  }, []);

  /**
   * «دفعة قديمة» — flip the row between a PAYMENT and an OPENING ADJUSTMENT.
   *
   * Turning it ON drops the proof, for the same reason `setAccount` does: the
   * write below never stores attachments on an opening row (there is no InstaPay
   * screenshot for money that moved before the app existed), so keeping the bytes
   * would leave them in attachments.db attached to nothing while the owner still
   * believes he filed them.
   */
  const setOpening = useCallback((isOpening: boolean) => {
    setDraft((prev) => {
      if (!isOpening) return { ...prev, isOpening };
      prev.proof.forEach((a) => removeAttachment(a.id));
      // Back to cash: the account is meaningless on an opening row (it reaches no
      // pocket), and leaving it on إنستاباي would put a pocket name on a row that
      // never touched one — the sheet must not remember a choice it stopped using.
      return { ...prev, isOpening, account: CASH, proof: [] };
    });
  }, []);

  /** Nudge the payment date by whole days. Never past today: money cannot move
   *  tomorrow, and a future-dated payment would show cash the drawer lacks. */
  const shiftDate = useCallback(
    (days: number) =>
      setDraft((prev) => ({
        ...prev,
        occurredAt: Math.min(Date.now(), addDays(prev.occurredAt, days)),
      })),
    [],
  );

  const addProof = useCallback(async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    try {
      const meta: AttachmentMeta = await ingest(picked);
      setDraft((prev) => ({ ...prev, proof: [...prev.proof, meta] }));
    } catch (err) {
      Alert.alert(t('payments.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const removeProof = useCallback((id: string) => {
    removeAttachment(id);
    setDraft((prev) => ({ ...prev, proof: prev.proof.filter((a) => a.id !== id) }));
  }, []);

  const amountMinor = toMinor(draft.amount);
  const canSave = amountMinor > 0 && !saving;

  const submit = useCallback(() => {
    if (saving) return;
    // The sign lives in `direction`, never in `amount` — so zero and negative are
    // not payments, they are typos.
    if (amountMinor <= 0) {
      Alert.alert(t('payments.errors.title'), t('payments.errors.amountRequired'));
      return;
    }
    setSaving(true);
    try {
      transactionRepository.create({
        // MONEY OUT — for an opening adjustment too. It is money the shop handed
        // over; the only difference is that it left the drawer before this app
        // existed. Give it +1 and it would push the debt UP like a refund.
        direction: -1,
        amount: amountMinor,
        occurredAt: draft.occurredAt,
        // An opening row reaches no pocket (it is excluded from `balances()`), so
        // its account is inert — but the column is NOT NULL and every row must
        // still be well-formed. `setOpening` has already forced it back to cash.
        account: draft.account,
        // THE WHOLE SWITCH. 'opening' settles the debt exactly like a payment and
        // stays out of the cash book: money that moved months ago must not empty
        // a drawer that is sitting full on the counter. See OPENING.
        refKind: draft.isOpening ? OPENING : target.refKind,
        refId: target.refId,
        note: draft.note.trim() || null,
        // Cash was handed over and both men saw it; InstaPay IS a screenshot, and
        // that screenshot is the only evidence the transfer ever happened. An
        // opening row has neither — there is nothing to photograph about money
        // that moved before the app was installed.
        attachments:
          !draft.isOpening && draft.account === 'instapay' ? draft.proof : undefined,
      });

      // SAY WHAT JUST HAPPENED, IN NUMBERS. The sheet used to simply vanish, and
      // the owner — with the supplier standing at the counter — had no answer to
      // "did it save?" but to go and look. The confirmation names the amount AND
      // what is still owed after it, because that is the number the man in front
      // of him is about to ask for.
      //
      // `suggestedAmount` is the outstanding balance the sheet was opened with,
      // so `− paid` is what is left. Over-paying (allowed, deliberately) lands at
      // zero or below and reads as "خلاص، مفيش عليه حاجة" — never a negative
      // remainder, which would be a credit and is a different sentence entirely.
      const remaining = (suggestedAmount ?? 0) - amountMinor;
      const body =
        remaining > 0
          ? t('payments.saved.withRemaining', {
              paid: money(amountMinor),
              name: payeeName,
              remaining: money(remaining),
            })
          : t('payments.saved.cleared', { paid: money(amountMinor), name: payeeName });

      Alert.alert(t('payments.saved.title'), body, [
        { text: t('documents.ok'), onPress: onSaved },
      ]);
    } catch (err) {
      Alert.alert(t('payments.errors.title'), String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  }, [
    amountMinor,
    draft,
    money,
    onSaved,
    payeeName,
    saving,
    suggestedAmount,
    t,
    target.refId,
    target.refKind,
  ]);

  return {
    draft,
    /** `draft.amount`, shaped for display (٢٥٫٢٠). The draft itself stays canonical. */
    amountValue: toLocaleDigits(draft.amount, i18n.language),
    setAmount,
    setAccount,
    setOpening,
    setNote,
    shiftDate,
    addProof,
    removeProof,
    canSave,
    saving,
    submit,
  };
}
