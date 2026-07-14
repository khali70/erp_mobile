import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AttachmentMeta } from '@/repositories/document-repository';
import type { Account } from '@/repositories/transaction-repository';
import { AccountToggle } from '@/features/payments/components/AccountToggle';
import { PaymentProofPicker } from '@/features/payments/components/PaymentProofPicker';
import { SplitPaymentToggle } from './SplitPaymentToggle';
import { SplitAmountRow } from './SplitAmountRow';

interface SalePaymentCardProps {
  account: Account;
  onChangeAccount: (account: Account) => void;
  split: boolean;
  onChangeSplit: (split: boolean) => void;
  /** The cash half, as typed (major units). Only used while `split` is on. */
  cashValue: string;
  onChangeCash: (value: string) => void;
  /** The InstaPay half — always the remainder. Major units. */
  instapayPart: number;
  /** True when any of the money came through InstaPay. */
  touchesInstapay: boolean;
  proof: AttachmentMeta[];
  onAddProof: () => void;
  onRemoveProof: (id: string) => void;
}

/**
 * HOW THE CUSTOMER PAID — the sale screen's half of the cash book.
 *
 * There is no "المدفوع" field here, and its absence is the design. A sale is
 * ALWAYS settled in full: customer debt (AR) is deprecated and unbuilt, so there
 * is no book anywhere that could hold an unpaid remainder — take 10,000 of goods
 * out of the shop against 6,000 of money and the missing 4,000 would exist
 * nowhere at all. So the owner is never asked HOW MUCH; only WHICH POCKET, and,
 * if he splits, how much of it was cash.
 *
 * The two pockets are what make this card worth existing: at closing the owner
 * counts his drawer against the cash figure and opens InstaPay for the other. A
 * sale that did not say which pocket could never be checked against either.
 */
export function SalePaymentCard({
  account,
  onChangeAccount,
  split,
  onChangeSplit,
  cashValue,
  onChangeCash,
  instapayPart,
  touchesInstapay,
  proof,
  onAddProof,
  onRemoveProof,
}: SalePaymentCardProps) {
  const { t } = useTranslation();

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <Text className="text-xs font-bold text-muted text-right">{t('payments.howPaid')}</Text>

      {/* One pocket: just say which. Split: the toggle below takes over. */}
      {!split && <AccountToggle value={account} onChange={onChangeAccount} />}

      <SplitPaymentToggle value={split} onChange={onChangeSplit} />

      {split && (
        <SplitAmountRow
          cashValue={cashValue}
          onChangeCash={onChangeCash}
          instapayPart={instapayPart}
        />
      )}

      {/* Cash needs no proof — the notes are in the drawer. An InstaPay transfer
          IS a screenshot, and it is the only evidence it ever happened. */}
      {touchesInstapay && (
        <PaymentProofPicker proof={proof} onAdd={onAddProof} onRemove={onRemoveProof} />
      )}
    </View>
  );
}
