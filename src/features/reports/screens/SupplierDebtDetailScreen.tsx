import { useState } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import colors from '@/theme/colors';
import { SettleSheet } from '@/features/payments/components/SettleSheet';
import { useSupplierDebtDetail } from '../hooks/useSupplierDebtDetail';
import { presentBalance, presentPayment, presentSettlement } from '../presenters';
import { SupplierDebtDetailHeader } from '../components/SupplierDebtDetailHeader';
import { InvoiceSettlementRow } from '../components/InvoiceSettlementRow';
import { PaymentHistorySection } from '../components/PaymentHistorySection';
import { EmptyNote } from '../components/EmptyNote';

type DetailRoute = RouteProp<RootStackParamList, 'SupplierDebtDetail'>;

/**
 * ONE SUPPLIER'S BOOK — which invoices his payments actually covered, and a way
 * to pay him days after the invoice closed.
 *
 * The invoice breakdown is DERIVED by the FIFO walk at read time. There are no
 * allocation rows behind it: a payment points at the SUPPLIER, never at an
 * invoice, which is exactly what makes the walk deterministic — no manual
 * invoice-picking exists anywhere in this UI, so no user action can contradict
 * it. The owner never sees the word "allocation"; he sees
 * "IN-000012 · سُدّدت بالكامل".
 *
 * Composition only: hook reads, presenters format, sheet writes.
 */
export function SupplierDebtDetailScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { supplierId, supplierName } = useRoute<DetailRoute>().params;
  const { detail, loading, error, reload } = useSupplierDebtDetail(supplierId);
  const [settleOpen, setSettleOpen] = useState(false);

  const balance = presentBalance(detail.owed, t, lang);

  const closeSheet = () => setSettleOpen(false);
  const handleSaved = () => {
    setSettleOpen(false);
    reload(); // re-derive; nothing was cached, so nothing can be stale
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={supplierName}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5">
        {/* A balance of ٠ and "لا توجد فواتير" are ANSWERS. Neither is true before
            the first read returns, and neither is true when it threw. */}
        {loading ? (
          <ActivityIndicator className="mt-8" color={colors.primary} />
        ) : error ? (
          <EmptyNote message={t('common.loadFailed')} />
        ) : (
        <FlatList
          data={detail.invoices}
          keyExtractor={(s) => s.documentId}
          ListHeaderComponent={
            <SupplierDebtDetailHeader
              balance={balance}
              // Same key the list row masks under, so a balance revealed there
              // stays revealed here rather than re-hiding on tap-through.
              maskId={`debt:${supplierId}`}
              onSettle={() => setSettleOpen(true)}
            />
          }
          renderItem={({ item }) => (
            <InvoiceSettlementRow
              settlement={presentSettlement(item, t, lang)}
              onPress={() => navigation.navigate('DocumentDetail', { documentId: item.documentId })}
            />
          )}
          ListEmptyComponent={<EmptyNote message={t('debts.noInvoices')} />}
          ListFooterComponent={
            <PaymentHistorySection
              payments={detail.payments.map((p) => presentPayment(p, t, lang))}
            />
          }
          contentContainerClassName="gap-3 pb-24"
          showsVerticalScrollIndicator={false}
        />
        )}
      </View>

      <SettleSheet
        visible={settleOpen}
        // Parameterised over the REF — Epic 3 pays an expense with this same
        // sheet by passing { refKind: 'expense', refId }. Nothing here is
        // hardcoded to suppliers except this one object.
        target={{ refKind: 'supplier', refId: supplierId }}
        title={t('debts.settleTo', { name: supplierName })}
        subtitle={detail.owed > 0 ? `${balance.title}: ${balance.amountLabel}` : undefined}
        // Pre-fill the whole outstanding balance: he usually came to settle up.
        // Zero when he is already in credit — paying more is allowed, but it
        // should not be the number the app suggests.
        suggestedAmount={Math.max(0, detail.owed)}
        onClose={closeSheet}
        onSaved={handleSaved}
      />
    </View>
  );
}
