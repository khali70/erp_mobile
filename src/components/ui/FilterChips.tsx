import { View, Text, Pressable } from 'react-native';
import { ROW } from '@/theme/rtl';

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  /** Tailwind bg class applied when this chip is active. */
  activeClass: string;
}

interface FilterChipsProps<K extends string> {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
}

/** Horizontal pill selector, generic over the filter key type. */
export function FilterChips<K extends string>({ options, value, onChange }: FilterChipsProps<K>) {
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
