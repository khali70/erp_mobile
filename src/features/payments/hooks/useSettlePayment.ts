import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fromMinor, toMinor } from '@/utils/money';
import { addDays } from '@/utils/dates';
import { ingest, pickPhoto, removeAttachment } from '@/utils/attachments';
import { transactionRepository } from '@/repositories/transaction-repository.client';
import type { Account } from '@/repositories/transaction-repository';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { SettleDraft, SettleTarget } from '../types';

interface UseSettlePaymentArgs {
  /** What the money is paid against (supplier today, expense in Epic 3). */
  target: SettleTarget;
  visible: boolean;
  /** Pre-fills المبلغ, in MINOR units — normally the full outstanding balance. */
  suggestedAmount?: number;
  /** Called after exactly one transaction row has been written. */
  onSaved: () => void;
}

const emptyDraft = (): SettleDraft => ({
  amount: '',
  account: 'cash',
  occurredAt: Date.now(),
  note: '',
  proof: [],
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
  onSaved,
}: UseSettlePaymentArgs) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SettleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // Re-arm on every open: a fresh date (today, not whenever the screen mounted)
  // and the current outstanding balance, which the last payment just changed.
  useEffect(() => {
    if (!visible) return;
    setDraft({
      ...emptyDraft(),
      // Minor → major exactly once, through fromMinor; never a hardcoded /100.
      amount: suggestedAmount && suggestedAmount > 0 ? String(fromMinor(suggestedAmount)) : '',
    });
  }, [visible, suggestedAmount]);

  const set = useCallback(
    <K extends keyof SettleDraft>(key: K, value: SettleDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setAmount = useCallback((amount: string) => set('amount', amount), [set]);
  const setAccount = useCallback((account: Account) => set('account', account), [set]);
  const setNote = useCallback((note: string) => set('note', note), [set]);

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
        direction: -1, // money OUT of the shop
        amount: amountMinor,
        occurredAt: draft.occurredAt,
        account: draft.account,
        refKind: target.refKind,
        refId: target.refId,
        note: draft.note.trim() || null,
        // Cash was handed over and both men saw it; InstaPay IS a screenshot, and
        // that screenshot is the only evidence the transfer ever happened.
        attachments: draft.account === 'instapay' ? draft.proof : undefined,
      });
      onSaved();
    } catch (err) {
      Alert.alert(t('payments.errors.title'), String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  }, [amountMinor, draft, onSaved, saving, t, target.refId, target.refKind]);

  return {
    draft,
    setAmount,
    setAccount,
    setNote,
    shiftDate,
    addProof,
    removeProof,
    canSave,
    saving,
    submit,
  };
}
