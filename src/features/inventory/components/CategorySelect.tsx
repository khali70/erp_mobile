import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import type { ItemCategory } from '../types';

const CATEGORIES: ItemCategory[] = [
  'tshirts',
  'jackets',
  'shoes',
  'pants',
  'shirts',
  'accessories',
  'other',
];

interface CategorySelectProps {
  label: string;
  value: ItemCategory;
  onChange: (category: ItemCategory) => void;
}

/** Horizontal chip selector for an item's category. */
export function CategorySelect({ label, value, onChange }: CategorySelectProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={`${ROW} gap-2`}>
        {CATEGORIES.map((category) => {
          const active = category === value;
          return (
            <Pressable
              key={category}
              className={`px-4 py-2 rounded-full border ${
                active ? 'bg-primary border-transparent' : 'bg-surface border-border'
              }`}
              onPress={() => onChange(category)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
                {t(`inventory.categories.${category}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
