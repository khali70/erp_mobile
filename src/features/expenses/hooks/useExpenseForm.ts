import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toMinor } from '@/utils/money';
import { addDays } from '@/utils/dates';
import { ingest, pickPhoto, removeAttachment } from '@/utils/attachments';
import { expenseRepository } from '@/repositories/expense-repository.client';
import type { ExpenseCategory } from '@/repositories/expense-repository';
import type { AttachmentMeta } from '@/repositories/document-repository';

/** The add-expense form's working state. `amount` is as TYPED, until save. */
export interface ExpenseDraft {
  title: string;
  category: ExpenseCategory;
  amount: string;
  incurredAt: number;
  /** FREE TEXT — the landlord, the electricity company. Never a supplier FK. */
  partyName: string;
  note: string;
  attachments: AttachmentMeta[];
}

const emptyDraft = (): ExpenseDraft => ({
  title: '',
  category: 'rent',
  amount: '',
  incurredAt: Date.now(),
  partyName: '',
  note: '',
  attachments: [],
});

interface UseExpenseFormArgs {
  visible: boolean;
  /** Called after the row is committed; reload your list here. */
  onSaved: () => void;
}

/**
 * ALL the behaviour behind "تسجيل نفقة جديدة": form state, the receipt photo,
 * and the single write.
 *
 * The amount crosses into MINOR units exactly once, here, through `toMinor` —
 * never a hardcoded ×100 at a call site, and never a float in the database.
 *
 * `partyName` stays free text on purpose. The landlord sells the shop nothing:
 * registering him as a supplier to name him would put a man who has never
 * delivered a box into the list the owner buys from, and into supplier debt.
 */
export function useExpenseForm({ visible, onSaved }: UseExpenseFormArgs) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // Re-arm on every open: a blank form dated TODAY, not whenever the screen
  // happened to mount.
  useEffect(() => {
    if (visible) setDraft(emptyDraft());
  }, [visible]);

  const set = useCallback(
    <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setTitle = useCallback((v: string) => set('title', v), [set]);
  const setCategory = useCallback((v: ExpenseCategory) => set('category', v), [set]);
  const setPartyName = useCallback((v: string) => set('partyName', v), [set]);
  const setNote = useCallback((v: string) => set('note', v), [set]);
  const setAmount = useCallback((v: string) => set('amount', v.replace(/[^0-9.]/g, '')), [set]);

  /** Nudge the date by whole days. Never into the future — a bill the shop has
   *  not received yet is not an obligation it can owe on. */
  const shiftDate = useCallback(
    (days: number) =>
      setDraft((prev) => ({
        ...prev,
        incurredAt: Math.min(Date.now(), addDays(prev.incurredAt, days)),
      })),
    [],
  );

  const addAttachment = useCallback(async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    try {
      const meta = await ingest(picked);
      setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, meta] }));
    } catch (err) {
      Alert.alert(t('expenses.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const removeAttachmentAt = useCallback((id: string) => {
    removeAttachment(id);
    setDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  }, []);

  const amountMinor = toMinor(draft.amount);
  const canSave = draft.title.trim().length > 0 && amountMinor > 0 && !saving;

  const submit = useCallback(() => {
    if (saving) return;
    if (!draft.title.trim()) {
      Alert.alert(t('expenses.errors.title'), t('expenses.errors.titleRequired'));
      return;
    }
    if (amountMinor <= 0) {
      Alert.alert(t('expenses.errors.title'), t('expenses.errors.amountRequired'));
      return;
    }
    setSaving(true);
    try {
      expenseRepository.create({
        title: draft.title,
        category: draft.category,
        totalAmount: amountMinor, // INTEGER minor units — the only conversion point
        incurredAt: draft.incurredAt,
        partyName: draft.partyName,
        note: draft.note,
        attachments: draft.attachments,
      });
      onSaved();
    } catch (err) {
      Alert.alert(t('expenses.errors.title'), String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  }, [amountMinor, draft, onSaved, saving, t]);

  return {
    draft,
    setTitle,
    setCategory,
    setAmount,
    setPartyName,
    setNote,
    shiftDate,
    addAttachment,
    removeAttachmentAt,
    canSave,
    saving,
    submit,
  };
}
