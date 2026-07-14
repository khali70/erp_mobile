import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/repositories/expense-repository';
import { CATEGORY_META } from '../category-meta';

interface ExpenseCategoryPickerProps {
  value: ExpenseCategory;
  onChange: (category: ExpenseCategory) => void;
}

/** الفئة المصنفة — one tap, no dropdown. Five buckets cover the whole shop. */
export function ExpenseCategoryPicker({ value, onChange }: ExpenseCategoryPickerProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">
        {t('expenses.form.category')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 flex-row-reverse"
      >
        {EXPENSE_CATEGORIES.map((c) => {
          const active = c === value;
          const meta = CATEGORY_META[c];
          return (
            <Pressable
              key={c}
              className={`${ROW} items-center gap-1.5 px-3.5 py-2.5 rounded-xl border ${
                active ? 'bg-primary border-transparent' : 'bg-background border-border'
              }`}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Feather name={meta.icon} size={14} color={active ? colors.surface : meta.color} />
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
                {t(`expenses.filters.${c}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
