import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toMinor } from '@/utils/money';
import { normalizeDigits, toLocaleDigits } from '@/utils/numerals';
import { addDays } from '@/utils/dates';
import { ingest, pickPhoto, removeAttachment } from '@/utils/attachments';
import { transactionRepository } from '@/repositories/transaction-repository.client';
import type {
  Account,
  CreateTransactionInput,
  TxDirection,
} from '@/repositories/transaction-repository';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { MovementDraft, MovementType } from '../types';

interface UseMovementFormArgs {
  visible: boolean;
  /** Called after the rows have been written — reload the ledger here. */
  onSaved: () => void;
}

const emptyDraft = (): MovementDraft => ({
  type: 'drawing',
  amount: '',
  account: 'cash',
  direction: -1,
  occurredAt: Date.now(),
  note: '',
  proof: [],
});

/** The other pocket. A transfer always has exactly two ends. */
const other = (account: Account): Account => (account === 'cash' ? 'instapay' : 'cash');

/**
 * RECORDING THE MOVEMENTS NOTHING ELSE CAN RECORD — and the reason the cash book
 * has no hole in it.
 *
 * The owner takes 200 from the drawer for lunch. A purchase screen cannot record
 * that. Neither can a sale, an expense or a supplier payment. If the app has no
 * way to say it, the app's cash figure quietly drifts away from the money in the
 * drawer — and the day those two stop matching is the day he stops trusting the
 * app entirely. So: drawings, injections, transfers, and an `'other'` escape
 * hatch, so that NO movement of money is ever unrecordable.
 *
 * A TRANSFER writes TWO rows, atomically (`createMany`) — out of one pocket and
 * into the other, both `ref_kind='transfer'`. It is neither income nor expense:
 * total cash across the accounts is unchanged. One row would destroy money; a
 * non-atomic pair would destroy it half the time.
 */
export function useMovementForm({ visible, onSaved }: UseMovementFormArgs) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<MovementDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // Re-arm on every open: a fresh date (today), an empty amount, no stale proof.
  useEffect(() => {
    if (!visible) return;
    setDraft(emptyDraft());
  }, [visible]);

  const set = useCallback(
    <K extends keyof MovementDraft>(key: K, value: MovementDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Canonical in, shaped out (`amountValue`): an Arabic-Indic amount reaching
  // `toMinor` parses to 0, and the sheet would then refuse to save with nothing
  // on screen saying why.
  const setAmount = useCallback((amount: string) => set('amount', normalizeDigits(amount)), [set]);
  const setAccount = useCallback((account: Account) => set('account', account), [set]);
  const setDirection = useCallback((direction: TxDirection) => set('direction', direction), [set]);
  const setNote = useCallback((note: string) => set('note', note), [set]);

  /** Switching type resets the sign to that type's meaning — a drawing is out,
   *  an injection is in, and only `'other'` lets the owner choose. */
  const setType = useCallback((type: MovementType) => {
    setDraft((prev) => ({
      ...prev,
      type,
      direction: type === 'injection' ? 1 : type === 'drawing' ? -1 : prev.direction,
    }));
  }, []);

  /** Money cannot move tomorrow: forward is capped at today. */
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
      Alert.alert(t('cashbook.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const removeProof = useCallback((id: string) => {
    removeAttachment(id);
    setDraft((prev) => ({ ...prev, proof: prev.proof.filter((a) => a.id !== id) }));
  }, []);

  const amountMinor = toMinor(draft.amount);
  const isTransfer = draft.type === 'transfer';
  /** The InstaPay side of the movement, wherever it is — proof rides on it. */
  const touchesInstapay =
    draft.account === 'instapay' || (isTransfer && other(draft.account) === 'instapay');
  const canSave = amountMinor > 0 && !saving;

  const rowsFor = useCallback(
    (d: MovementDraft, amount: number): CreateTransactionInput[] => {
      const note = d.note.trim() || null;
      const proofFor = (account: Account) =>
        account === 'instapay' && d.proof.length ? d.proof : undefined;

      if (d.type === 'transfer') {
        const to = other(d.account);
        // TWO rows, netting to zero. Split them and the shop appears to have lost
        // the money; merge them and it appears never to have moved.
        return [
          {
            direction: -1,
            amount,
            occurredAt: d.occurredAt,
            account: d.account,
            refKind: 'transfer',
            refId: null,
            note,
            attachments: proofFor(d.account),
          },
          {
            direction: 1,
            amount,
            occurredAt: d.occurredAt,
            account: to,
            refKind: 'transfer',
            refId: null,
            note,
            attachments: proofFor(to),
          },
        ];
      }

      const isOwner = d.type === 'drawing' || d.type === 'injection';
      return [
        {
          direction: d.type === 'drawing' ? -1 : d.type === 'injection' ? 1 : d.direction,
          amount,
          occurredAt: d.occurredAt,
          account: d.account,
          // An owner drawing points at NOBODY: ref_id is null. It is not a debt
          // to anyone and it must never touch a supplier's balance — it only
          // moves the drawer.
          refKind: isOwner ? 'owner' : 'other',
          refId: null,
          note,
          attachments: proofFor(d.account),
        },
      ];
    },
    [],
  );

  const submit = useCallback(() => {
    if (saving) return;
    // The sign lives in `direction`; zero and negative are not movements, they
    // are typos.
    if (amountMinor <= 0) {
      Alert.alert(t('cashbook.errors.title'), t('payments.errors.amountRequired'));
      return;
    }
    setSaving(true);
    try {
      transactionRepository.createMany(rowsFor(draft, amountMinor));
      onSaved();
    } catch (err) {
      Alert.alert(t('cashbook.errors.title'), String((err as Error)?.message ?? err));
    } finally {
      setSaving(false);
    }
  }, [amountMinor, draft, onSaved, rowsFor, saving, t]);

  return {
    draft,
    /** `draft.amount`, shaped for display. The draft itself stays canonical. */
    amountValue: toLocaleDigits(draft.amount, i18n.language),
    isTransfer,
    touchesInstapay,
    /** Where a transfer lands — shown as "من النقدي إلى إنستاباي". */
    toAccount: other(draft.account),
    setType,
    setAmount,
    setAccount,
    setDirection,
    setNote,
    shiftDate,
    addProof,
    removeProof,
    canSave,
    saving,
    submit,
  };
}
