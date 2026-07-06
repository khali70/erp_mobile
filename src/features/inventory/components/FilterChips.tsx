import { View, Text, Pressable } from 'react-native';
import { ROW } from '@/theme/rtl';
import type { StockFilter } from '../types';

export interface FilterOption {
  key: StockFilter;
  label: string;
  /** Tailwind bg class applied when this chip is active. */
  activeClass: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  value: StockFilter;
  onChange: (key: StockFilter) => void;
}

/** Horizontal pill selector for the stock filter. */
export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  return (
    <View className={`${ROW} gap-2`}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            className={`px-5 py-2 rounded-full border ${
              active ? `${option.activeClass} border-transparent` : 'bg-surface border-border'
            }`}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
