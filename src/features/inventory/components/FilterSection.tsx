import type { ReactNode } from 'react';
import { View, Text } from 'react-native';

interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

/** One labelled block inside the advanced-filter sheet. */
export function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold text-ink text-right">{title}</Text>
      {children}
    </View>
  );
}
