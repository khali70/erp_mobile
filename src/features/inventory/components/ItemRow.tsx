import { View, Text, Pressable } from 'react-native';
import { ROW } from '@/theme/rtl';
import type { ItemCategory } from '../types';
import type { ItemRowViewModel } from '../presenters';
import { CategoryAvatar } from './CategoryAvatar';
import { StockBadge } from './StockBadge';

interface ItemRowProps {
  item: ItemRowViewModel;
  category: ItemCategory;
  onPress: () => void;
  onLongPress?: () => void;
}

/** A single item card: category avatar + name/category, price + stock badge. */
export function ItemRow({ item, category, onPress, onLongPress }: ItemRowProps) {
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3`}>
        <CategoryAvatar category={category} />
        <View className="gap-0.5">
          <Text className="text-sm font-semibold text-ink text-right">{item.name}</Text>
          <Text className="text-[11px] text-muted font-medium text-right">{item.categoryLabel}</Text>
        </View>
      </View>

      <View className="items-end gap-1.5">
        <Text className="text-base font-bold text-ink text-right">
          {item.priceLabel} <Text className="text-[10px] font-normal text-muted">{item.currency}</Text>
        </Text>
        <StockBadge status={item.status} label={item.badgeLabel} />
      </View>
    </Pressable>
  );
}
