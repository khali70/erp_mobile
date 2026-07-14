import { useCallback, useState } from 'react';
import { View, Text, SectionList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import colors from '@/theme/colors';
import { useCashBook } from '../hooks/useCashBook';
import { presentDay, presentEntry, type LedgerDayViewModel } from '../presenters';
import type { LedgerEntry } from '../types';
import { CashBalanceCards } from '../components/CashBalanceCards';
import { DailySalesCard } from '../components/DailySalesCard';
import { CashDayHeader } from '../components/CashDayHeader';
import { CashEntryRow } from '../components/CashEntryRow';
import { CashBookEmptyState } from '../components/CashBookEmptyState';
import { RecordMovementSheet } from '../components/RecordMovementSheet';

/**
 * دفتر النقدية — EVERY MOVEMENT OF MONEY, IN ONE BOOK.
 *
 * Sales in, supplier payments out, bills, the owner's own drawings, and
 * transfers between the drawer and InstaPay — each one a row, each one saying
 * WHY the money moved, grouped by the day it moved on.
 *
 * This screen is what makes the app trustworthy. At closing the owner counts the
 * notes in his drawer and compares them with نقدي; he opens InstaPay and compares
 * that with إنستاباي. Two pockets, each reconcilable against something real — a
 * single merged number could never be checked against anything at all.
 *
 * Every figure is DERIVED from the rows beneath it and cached nowhere, so no
 * balance here can drift from the ledger: it IS the ledger, summed.
 *
 * Composition only: the hook reads, the presenters format, the rows render, the
 * sheet writes.
 */
export function CashBookScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { days, balances, salesToday, isEmpty, loading, error, reload } = useCashBook();
  const [recordOpen, setRecordOpen] = useState(false);
  const today = Date.now();

  const handleSaved = useCallback(() => {
    setRecordOpen(false);
    reload(); // re-derive; nothing is cached, so nothing can be stale
  }, [reload]);

  const sections = days.map((day) => ({
    day: presentDay(day, t, lang, today),
    data: day.entries,
  }));

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('cashbook.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{
          icon: 'plus',
          onPress: () => setRecordOpen(true),
          accessibilityLabel: t('cashbook.form.title'),
        }}
      />

      <SectionList<LedgerEntry, { day: LedgerDayViewModel }>
        sections={sections}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <CashBalanceCards balances={balances} />
            <DailySalesCard sales={salesToday} />
          </View>
        }
        renderSectionHeader={({ section }) => <CashDayHeader day={section.day} />}
        renderItem={({ item }) => <CashEntryRow entry={presentEntry(item, t, lang)} />}
        // "No movements yet" is an ANSWER. Before the first read returns there is
        // no answer, and a repository throw is not one either.
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="mt-8" color={colors.primary} />
          ) : error ? (
            <Text className="text-muted text-xs text-center mt-8">{t('common.loadFailed')}</Text>
          ) : isEmpty ? (
            <CashBookEmptyState />
          ) : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerClassName="px-4 py-4 pb-24 gap-2.5"
        showsVerticalScrollIndicator={false}
      />

      <RecordMovementSheet
        visible={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}
