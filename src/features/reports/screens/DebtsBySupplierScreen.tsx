import { View, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { fromMinor } from '@/utils/money';
import { formatNumber } from '@/utils/numerals';
import { useSupplierDebts } from '../hooks/useSupplierDebts';
import { presentSupplierDebt, presentUnpaidExpense } from '../presenters';
import { SupplierDebtRow } from '../components/SupplierDebtRow';
import { DebtsEmptyState } from '../components/DebtsEmptyState';
import { DebtsTotalCard } from '../components/DebtsTotalCard';
import { UnpaidExpensesSection } from '../components/UnpaidExpensesSection';

/**
 * WHAT THE SHOP OWES, WORST FIRST — suppliers, and the bills that are debt too.
 *
 * Every figure here is DERIVED: posted purchase invoices minus payments (walked
 * FIFO for the aging), and each bill's total minus the payments pointing at it.
 * Nothing is stored, so nothing can drift. A fully-paid supplier is simply
 * absent, and the sentinel walk-in party can never appear — a debt to "بدون مورد"
 * is a debt to nobody, which the owner could neither pay nor reconcile.
 *
 * The unpaid-bills section is here because the owner's real question is "what do
 * I owe", and the suppliers are only one slice of the answer.
 *
 * Composition only: the hook reads, the presenters format, the rows render.
 */
export function DebtsBySupplierScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { debts, unpaidExpenses, totalOwed, expensesOwed, isEmpty } = useSupplierDebts();

  const money = (minor: number) => `${formatNumber(fromMinor(minor), lang)} ${t('common.currency')}`;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('debts.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5">
        {isEmpty ? (
          <DebtsEmptyState />
        ) : (
          <FlatList
            data={debts}
            keyExtractor={(d) => d.id}
            ListHeaderComponent={
              <DebtsTotalCard
                totalLabel={money(totalOwed)}
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
            ListFooterComponent={
              <UnpaidExpensesSection
                expenses={unpaidExpenses.map((e) => presentUnpaidExpense(e, t, lang))}
                totalLabel={money(expensesOwed)}
                // Bills are paid on the expenses screen, with the same سداد sheet
                // that pays a supplier.
                onPressExpense={() => navigation.navigate('Expenses')}
              />
            }
            contentContainerClassName="gap-3 pb-24"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
