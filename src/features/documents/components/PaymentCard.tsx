import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { Account } from '@/repositories/transaction-repository';
import { PaidAmountRow } from './PaidAmountRow';
import { AccountToggle } from '@/features/payments/components/AccountToggle';
import { PaymentProofPicker } from '@/features/payments/components/PaymentProofPicker';
import { RemainingDebtRow } from './RemainingDebtRow';

interface PaymentCardProps {
  /** المدفوع as typed (major units); pre-filled with the full total until touched. */
  paidValue: string;
  onChangePaid: (value: string) => void;
  account: Account;
  onChangeAccount: (account: Account) => void;
  proof: AttachmentMeta[];
  onAddProof: () => void;
  onRemoveProof: (id: string) => void;
  /** Total − paid, major units. The row hides itself when this is not positive. */
  remaining: number;
}

/**
 * The payment card on the purchase screen — the gap this whole epic exists to
 * close. The summary footer used to show only عدد الأصناف and الإجمالي, so the
 * app could record what arrived but never what was PAID for it. A posted
 * purchase was always the event "I took goods from Ahmed"; this card finally
 * records the other half, and whatever is left over becomes real debt.
 */
export function PaymentCard({
  paidValue,
  onChangePaid,
  account,
  onChangeAccount,
  proof,
  onAddProof,
  onRemoveProof,
  remaining,
}: PaymentCardProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      {/* Titled like every other card on the screen — and like SalePaymentCard,
          its opposite number. An untitled block of money fields leaves the owner
          to infer what he is being asked. */}
      <Text className="text-xs font-bold text-muted text-right">{t('payments.howPaid')}</Text>

      <PaidAmountRow value={paidValue} onChange={onChangePaid} />
      <AccountToggle value={account} onChange={onChangeAccount} />

      {/* Cash needs no proof — the money was handed over and both men saw it.
          InstaPay IS a screenshot, and it is the only evidence there will be. */}
      {account === 'instapay' && (
        <PaymentProofPicker proof={proof} onAdd={onAddProof} onRemove={onRemoveProof} />
      )}

      <RemainingDebtRow remaining={remaining} />
    </View>
  );
}
