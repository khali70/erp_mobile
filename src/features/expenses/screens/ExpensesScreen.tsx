import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import { ExpenseRow } from '../components/ExpenseRow';
import { AddExpenseSheet } from '../components/AddExpenseSheet';
import { DEMO_EXPENSES, type Expense, type ExpenseCategory } from '../data';

type Filter = 'all' | ExpenseCategory;
const LAST_MONTH_TOTAL = 4600;

/**
 * النفقات والمصروفات — expenses list. Red month-total card, category filter
 * chips, expense rows, and an add-expense bottom sheet (with attachment input).
 * NativeWind only; copy via i18n; demo data until the expense repo lands.
 */
export function ExpensesScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');

  const [expenses, setExpenses] = useState<Expense[]>(DEMO_EXPENSES);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const visible = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter],
  );

  const filterOptions: FilterOption<Filter>[] = [
    { key: 'all', label: t('expenses.filters.all'), activeClass: 'bg-primary' },
    { key: 'rent', label: t('expenses.filters.rent'), activeClass: 'bg-primary' },
    { key: 'salaries', label: t('expenses.filters.salaries'), activeClass: 'bg-primary' },
    { key: 'utilities', label: t('expenses.filters.utilities'), activeClass: 'bg-primary' },
    { key: 'transport', label: t('expenses.filters.transport'), activeClass: 'bg-primary' },
    { key: 'other', label: t('expenses.filters.other'), activeClass: 'bg-primary' },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('expenses.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{ icon: 'plus', onPress: () => setSheetOpen(true), accessibilityLabel: t('expenses.add') }}
      />

      <ScrollView contentContainerClassName="px-4 py-4 pb-8 gap-4" showsVerticalScrollIndicator={false}>
        {/* month total */}
        <View className="bg-surface rounded-2xl p-5 border border-border items-center gap-1">
          <Text className="text-danger text-3xl font-extrabold">
            {formatNumber(total, lang)} <Text className="text-lg">{currency}</Text>
          </Text>
          <Text className="text-muted text-sm font-semibold">
            {t('expenses.currentMonth', { month: t('expenses.monthName', { defaultValue: 'يوليو' }) })}
          </Text>
          <Text className="text-slate-400 text-xs">
            {t('expenses.lastMonth')}: {formatNumber(LAST_MONTH_TOTAL, lang)} {currency}
          </Text>
        </View>

        {/* filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row-reverse">
          <FilterChips options={filterOptions} value={filter} onChange={(k) => setFilter(k)} />
        </ScrollView>

        {/* rows */}
        <View className="gap-3">
          {visible.map((e) => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </View>
      </ScrollView>

      {/* floating add */}
      <Pressable
        className={`absolute bottom-6 ${lang === 'ar' ? 'left-6' : 'right-6'} w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg`}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('expenses.add')}
      >
        <Text className="text-white text-3xl font-light leading-none">+</Text>
      </Pressable>

      <AddExpenseSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={(exp) => setExpenses((prev) => [exp, ...prev])}
      />
    </View>
  );
}
