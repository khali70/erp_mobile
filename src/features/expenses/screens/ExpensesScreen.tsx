import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SettleSheet } from '@/features/payments/components/SettleSheet';
import { formatMonth } from '@/utils/dates';
import { useExpenses } from '../hooks/useExpenses';
import { money, presentExpense, type ExpenseViewModel } from '../presenters';
import { ExpensesTotalCard } from '../components/ExpensesTotalCard';
import { ExpenseFilterChips } from '../components/ExpenseFilterChips';
import { ExpenseRow } from '../components/ExpenseRow';
import { ExpensesEmptyState } from '../components/ExpensesEmptyState';
import { AddExpenseSheet } from '../components/AddExpenseSheet';
import { categories } from '@/db/schema';

/**
 * النفقات والمصروفات — RENT IS DEBT TOO.
 *
 * These rows were `DEMO_EXPENSES` until this epic: a mock list that died with the
 * screen. They are real obligations now, and the owner pays them down with the
 * SAME سداد sheet that pays a supplier — `{ refKind: 'expense', refId }` instead
 * of `{ refKind: 'supplier', refId }`, one cash-book row, no fork of the sheet.
 *
 * That is the point of the whole epic: an unpaid bill is debt in exactly the same
 * sense an unpaid invoice is, so it is derived by the same subtraction, paid by
 * the same sheet, and counted in the same payables KPI — which, until now, was
 * quietly leaving all of it out.
 *
 * Composition only: the hook reads, the presenter formats, the sheets write.
 */
export function ExpensesScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { expenses, filter, setFilter, monthTotal, lastMonthTotal, unpaidTotal, reload } =
    useExpenses();

  const [addOpen, setAddOpen] = useState(false);
  const [settling, setSettling] = useState<ExpenseViewModel | null>(null);

  const handleAdded = useCallback(() => {
    setAddOpen(false);
    reload();
  }, [reload]);

  const handleSettled = useCallback(() => {
    setSettling(null);
    reload(); // re-derive; nothing is cached, so nothing can be stale
  }, [reload]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('expenses.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{
          icon: 'plus',
          onPress: () => setAddOpen(true),
          accessibilityLabel: t('expenses.add'),
        }}
      />

      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            <ExpensesTotalCard
              monthLabel={money(monthTotal, t, lang)}
              monthName={formatMonth(Date.now(), lang)}
              lastMonthLabel={money(lastMonthTotal, t, lang)}
              unpaidLabel={unpaidTotal > 0 ? money(unpaidTotal, t, lang) : null}
            />
            <ExpenseFilterChips value={filter} onChange={setFilter} />
          </View>
        }
        renderItem={({ item }) => {
          const vm = presentExpense(item, t, lang);
          return <ExpenseRow expense={vm} onSettle={() => setSettling(vm)} />;
        }}
        ListEmptyComponent={<ExpensesEmptyState filtered={filter !== 'all'} />}
        contentContainerClassName="px-4 py-4 pb-24 gap-3"
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        className={`absolute bottom-6 ${lang === 'ar' ? 'left-6' : 'right-6'} w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg`}
        onPress={() => setAddOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('expenses.add')}
      >
        <Text className="text-white text-3xl font-light leading-none">+</Text>
      </Pressable>

      <AddExpenseSheet
        visible={addOpen}
        initialCategory={filter === 'all' ? undefined : filter}
        onClose={() => setAddOpen(false)}
        onSaved={handleAdded}
      />

      {settling ? (
        <SettleSheet
          visible
          // THE reusable sheet, unchanged. It was parameterised over the ref in
          // Epic 2 precisely so paying the rent would need no new code — only a
          // different `refKind`.
          target={{ refKind: 'expense', refId: settling.id }}
          title={t('expenses.settleFor', { title: settling.title })}
          subtitle={settling.remainingLabel ?? undefined}
          // Pre-fill what is still owed on THIS bill, not its full total — the
          // rent that is half paid should suggest the half that is left.
          suggestedAmount={settling.suggestedAmount}
          // A bill is paid TO something the owner named ("إيجار المحل") — the
          // confirmation says it back to him with the figures.
          payeeName={settling.title}
          onClose={() => setSettling(null)}
          onSaved={handleSettled}
        />
      ) : null}
    </View>
  );
}
