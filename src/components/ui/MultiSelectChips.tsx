import { View, Text, Pressable } from 'react-native';
import { ROW } from '@/theme/rtl';

export interface MultiSelectOption {
  key: string;
  label: string;
}

interface MultiSelectChipsProps {
  options: MultiSelectOption[];
  /** Currently selected keys. Empty = nothing selected. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Shown instead of the chips when there is nothing to pick from. */
  emptyLabel?: string;
}

/**
 * Wrapping pill group where ANY number of options can be on at once — the
 * multi-select twin of <FilterChips>. Purely presentational: it owns no state,
 * it just hands back the next selection.
 */
export function MultiSelectChips({ options, value, onChange, emptyLabel }: MultiSelectChipsProps) {
  if (options.length === 0) {
    return emptyLabel ? <Text className="text-muted text-xs text-right">{emptyLabel}</Text> : null;
  }

  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <View className={`${ROW} flex-wrap gap-2`}>
      {options.map((option) => {
        const active = value.includes(option.key);
        return (
          <Pressable
            key={option.key}
            className={`px-4 py-2 rounded-full border ${
              active ? 'bg-primary border-transparent' : 'bg-surface border-border'
            }`}
            onPress={() => toggle(option.key)}
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
