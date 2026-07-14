import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SectionLabel } from './SectionLabel';
import { PaymentHistoryRow } from './PaymentHistoryRow';
import { EmptyNote } from './EmptyNote';
import type { PaymentViewModel } from '../presenters';

interface PaymentHistorySectionProps {
  payments: PaymentViewModel[];
  /** Long-press on a row — the only way to take a mistyped سداد back out of the debt. */
  onLongPressPayment: (paymentId: string) => void;
}

/**
 * المدفوعات — every payment made to this supplier, oldest money first.
 *
 * These rows are the OTHER half of the debt subtraction: the invoices above say
 * what was taken, these say what was given back. Together they are the whole
 * argument, and there is no third thing (no allocation) to go looking for.
 *
 * Rendered as a plain group, not a nested list: it is the footer of the detail
 * screen's FlatList, and a supplier's payment history is bounded by how often he
 * has actually been paid.
 */
export function PaymentHistorySection({
  payments,
  onLongPressPayment,
}: PaymentHistorySectionProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-3 mt-2">
      <SectionLabel title={t('debts.payments')} icon="credit-card" />

      {payments.length === 0 ? (
        <EmptyNote message={t('debts.noPayments')} />
      ) : (
        payments.map((p) => (
          <PaymentHistoryRow
            key={p.id}
            payment={p}
            onLongPress={() => onLongPressPayment(p.id)}
          />
        ))
      )}
    </View>
  );
}
