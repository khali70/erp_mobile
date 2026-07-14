import { ScrollView, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { SettleSheetHeader } from '@/features/payments/components/SettleSheetHeader';
import { SettleAmountField } from '@/features/payments/components/SettleAmountField';
import { AccountToggle } from '@/features/payments/components/AccountToggle';
import { SettleDateField } from '@/features/payments/components/SettleDateField';
import { PaymentProofPicker } from '@/features/payments/components/PaymentProofPicker';
import { useMovementForm } from '../hooks/useMovementForm';
import { MovementTypePicker } from './MovementTypePicker';
import { MovementDirectionToggle } from './MovementDirectionToggle';
import { TransferRouteRow } from './TransferRouteRow';

interface RecordMovementSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after the row(s) are written — reload the ledger here. */
  onSaved: () => void;
}

/**
 * تسجيل حركة — THE SHEET THAT KEEPS THE CASH BOOK HONEST.
 *
 * Drawings, injections, transfers, and anything else. Every other money screen
 * in this app records a movement as a side-effect of something (a purchase, a
 * sale, a bill). This one records the movement itself, for the cases where there
 * IS nothing else: the owner takes 200 for lunch, or moves 5000 from the drawer
 * into InstaPay.
 *
 * Without it the app's cash figure drifts from the physical drawer, and once the
 * two disagree the owner cannot tell which is lying — so he stops trusting the
 * app, and an untrusted cash book is worse than none.
 *
 * The fields are the SAME components the سداد sheet uses (amount, account, date,
 * conditional proof) — one vocabulary for money, everywhere in the app.
 */
export function RecordMovementSheet({ visible, onClose, onSaved }: RecordMovementSheetProps) {
  const { t } = useTranslation();
  const {
    draft,
    isTransfer,
    touchesInstapay,
    toAccount,
    setType,
    setAmount,
    setAccount,
    setDirection,
    setNote,
    shiftDate,
    addProof,
    removeProof,
    canSave,
    submit,
  } = useMovementForm({ visible, onSaved });

  return (
    <BottomSheet visible={visible} onClose={onClose} className="overflow-hidden">
      <SettleSheetHeader
        title={t('cashbook.form.title')}
        subtitle={t('cashbook.form.subtitle')}
        onClose={onClose}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 gap-4 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MovementTypePicker value={draft.type} onChange={setType} />

        <SettleAmountField value={draft.amount} onChange={setAmount} />

        {/* For a transfer the toggle picks the SOURCE pocket; the destination is
            the other one, and the route below says so in words. */}
        <AccountToggle value={draft.account} onChange={setAccount} />
        {isTransfer && <TransferRouteRow from={draft.account} to={toAccount} />}

        {/* Only the escape hatch has to be told which way the money went. */}
        {draft.type === 'other' && (
          <MovementDirectionToggle value={draft.direction} onChange={setDirection} />
        )}

        <SettleDateField value={draft.occurredAt} onShift={shiftDate} />

        {/* Proof rides on the InstaPay side, wherever it is — cash was handed
            over and there is nothing to photograph. */}
        {touchesInstapay && (
          <PaymentProofPicker proof={draft.proof} onAdd={addProof} onRemove={removeProof} />
        )}

        <LabeledInput
          label={t('payments.note')}
          value={draft.note}
          onChangeText={setNote}
          placeholder={t('cashbook.form.notePlaceholder')}
          multiline
        />

        <Pressable
          className={`mt-1 py-3.5 rounded-2xl items-center ${canSave ? 'bg-primary' : 'bg-border'}`}
          disabled={!canSave}
          onPress={submit}
          accessibilityRole="button"
        >
          <Text className={`font-bold text-base ${canSave ? 'text-white' : 'text-muted'}`}>
            {t('cashbook.form.save')}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
