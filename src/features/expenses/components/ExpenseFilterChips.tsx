import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { EXPENSE_CATEGORIES } from '@/repositories/expense-repository';
import type { ExpenseFilter } from '../hooks/useExpenses';

interface ExpenseFilterChipsProps {
  value: ExpenseFilter;
  onChange: (filter: ExpenseFilter) => void;
}

/** الكل · إيجار · رواتب · كهرباء · نقل · أخرى — the category filter row. */
export function ExpenseFilterChips({ value, onChange }: ExpenseFilterChipsProps) {
  const { t } = useTranslation();

  const options: FilterOption<ExpenseFilter>[] = [
    { key: 'all', label: t('expenses.filters.all'), activeClass: 'bg-primary' },
    ...EXPENSE_CATEGORIES.map((c) => ({
      key: c as ExpenseFilter,
      label: t(`expenses.filters.${c}`),
      activeClass: 'bg-primary',
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row-reverse"
    >
      <FilterChips options={options} value={value} onChange={onChange} />
    </ScrollView>
  );
}
