import { View, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { fromMinor } from '@/utils/money';
import { formatNumber } from '@/utils/numerals';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { presentSupplierDebt } from '../presenters';
import { SupplierDebtRow } from '../components/SupplierDebtRow';
import { DebtsEmptyState } from '../components/DebtsEmptyState';
import { DebtsTotalCard } from '../components/DebtsTotalCard';

/**
 * ديون الموردين — WHO THE SHOP OWES, WORST FIRST.
 *
 * Every figure here is DERIVED: posted purchase invoices minus payments, walked
 * FIFO for the aging. Nothing is stored, so nothing can drift. A fully-paid
 * supplier is simply absent, and the sentinel walk-in party can never appear — a
 * debt to "بدون مورد" is a debt to nobody, which the owner could neither pay nor
 * reconcile.
 *
 * Composition only: the hook reads, the presenter formats, the rows render.
 */
export function DebtsBySupplierScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { debts, totalOwed } = useSupplierDebts();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('debts.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5">
        {debts.length === 0 ? (
          <DebtsEmptyState />
        ) : (
          <FlatList
            data={debts}
            keyExtractor={(d) => d.id}
            ListHeaderComponent={
              <DebtsTotalCard
                totalLabel={`${formatNumber(fromMinor(totalOwed), lang)} ${t('common.currency')}`}
                countLabel={t('debts.supplierCount', { n: formatNumber(debts.length, lang) })}
              />
            }
            renderItem={({ item }) => (
              <SupplierDebtRow
                debt={presentSupplierDebt(item, t, lang)}
                onPress={() =>
                  navigation.navigate('SupplierDebtDetail', {
                    supplierId: item.id,
                    supplierName: item.name,
                  })
                }
              />
            )}
            contentContainerClassName="gap-3 pb-24"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
