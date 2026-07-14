import { ScrollView, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useSettlePayment } from '../hooks/useSettlePayment';
import type { SettleTarget } from '../types';
import { SettleSheetHeader } from './SettleSheetHeader';
import { SettleAmountField } from './SettleAmountField';
import { AccountToggle } from './AccountToggle';
import { SettleDateField } from './SettleDateField';
import { PaymentProofPicker } from './PaymentProofPicker';

interface SettleSheetProps {
  visible: boolean;
  /** WHAT is being paid: a supplier today, an expense in Epic 3. */
  target: SettleTarget;
  title: string;
  subtitle?: string;
  /** Pre-fills المبلغ (minor units) — normally the whole outstanding balance. */
  suggestedAmount?: number;
  onClose: () => void;
  /** Fired after the single cash-book row is written; reload your data here. */
  onSaved: () => void;
}

/**
 * سداد — THE REUSABLE PAYMENT SHEET.
 *
 * It is parameterised over `target` ({ refKind, refId }) and knows nothing about
 * suppliers. Epic 3 pays the rent with this exact component by passing
 * `{ refKind: 'expense', refId }` — same fields, same one row in the cash book,
 * no fork of this file.
 *
 * Collects المبلغ · الحساب · التاريخ · إثبات الدفع · ملاحظة, and writes exactly
 * ONE `transactions` row with NO document involved (the invoice closed days ago;
 * this is just the money finally moving).
 *
 * إثبات الدفع appears ONLY for إنستاباي — cash was handed over and both men saw
 * it, so there is nothing to photograph; an InstaPay transfer IS a screenshot,
 * and that screenshot is the only evidence it ever happened.
 */
export function SettleSheet({
  visible,
  target,
  title,
  subtitle,
  suggestedAmount,
  onClose,
  onSaved,
}: SettleSheetProps) {
  const { t } = useTranslation();
  const {
    draft,
    setAmount,
    setAccount,
    setNote,
    shiftDate,
    addProof,
    removeProof,
    canSave,
    submit,
  } = useSettlePayment({ target, visible, suggestedAmount, onSaved });

  return (
    <BottomSheet visible={visible} onClose={onClose} className="overflow-hidden">
      <SettleSheetHeader title={title} subtitle={subtitle} onClose={onClose} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 gap-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <SettleAmountField value={draft.amount} onChange={setAmount} />
        <AccountToggle value={draft.account} onChange={setAccount} />
        <SettleDateField value={draft.occurredAt} onShift={shiftDate} />

        {draft.account === 'instapay' && (
          <PaymentProofPicker proof={draft.proof} onAdd={addProof} onRemove={removeProof} />
        )}

        <LabeledInput
          label={t('payments.note')}
          value={draft.note}
          onChangeText={setNote}
          placeholder={t('payments.notePlaceholder')}
          multiline
        />

        <Pressable
          className={`mt-1 py-3.5 rounded-2xl items-center ${canSave ? 'bg-primary' : 'bg-border'}`}
          disabled={!canSave}
          onPress={submit}
          accessibilityRole="button"
        >
          <Text className={`font-bold text-base ${canSave ? 'text-white' : 'text-muted'}`}>
            {t('debts.settle')}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
