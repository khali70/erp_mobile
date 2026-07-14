import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SupplierBalanceCard } from './SupplierBalanceCard';
import { SectionLabel } from './SectionLabel';
import type { BalanceViewModel } from '../presenters';

interface SupplierDebtDetailHeaderProps {
  balance: BalanceViewModel;
  maskId: string;
  onSettle: () => void;
}

/** Top of the supplier detail screen: his balance, سداد, and the الفواتير heading. */
export function SupplierDebtDetailHeader({
  balance,
  maskId,
  onSettle,
}: SupplierDebtDetailHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <SupplierBalanceCard balance={balance} maskId={maskId} onSettle={onSettle} />
      <SectionLabel title={t('debts.invoices')} icon="file-text" />
    </View>
  );
}
