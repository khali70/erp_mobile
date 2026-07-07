import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { ItemRowViewModel } from '../presenters';
import { CategoryAvatar } from './CategoryAvatar';
import { StockBadge } from './StockBadge';

interface ItemRowProps {
  item: ItemRowViewModel;
  onPress: () => void;
  onLongPress?: () => void;
}

/** Small pill: filled = value present, dashed/danger = missing important value. */
function Chip({ icon, label, empty }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; empty?: boolean }) {
  const box = empty
    ? 'bg-danger-light border-rose-100 border-dashed'
    : 'bg-background border-border';
  const tint = empty ? 'text-danger' : 'text-muted';
  const iconColor = empty ? colors.danger : colors.muted;
  return (
    <View className={`${ROW} items-center gap-1 px-2 py-0.5 rounded-md border ${box}`}>
      <MaterialCommunityIcons name={icon} size={12} color={iconColor} />
      <Text className={`text-[11px] font-medium ${tint}`}>{label}</Text>
    </View>
  );
}

/** A single item card: category avatar + name/category, chips, price + stock badge. */
export function ItemRow({ item, onPress, onLongPress }: ItemRowProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      className={`bg-surface rounded-[18px] p-3.5 border border-border ${ROW} items-center justify-between`}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
    >
      <View className={`${ROW} items-center gap-3 flex-1`}>
        <CategoryAvatar color={item.categoryColor} />
        <View className="gap-1 flex-1 items-start">
          <Text className="text-sm font-semibold text-ink text-right">{item.name}</Text>
          <Text className="text-[11px] text-muted font-medium text-right">{item.categoryLabel}</Text>
          <View className={`${ROW} items-center gap-1.5 flex-wrap`}>
            {!item.barcodeLabel && (
              <Chip
                icon="barcode"
                label={t('inventory.chip.noBarcode')}
                empty={!item.barcodeLabel}
              />
            )}
            {!item.salePriceLabel && (
              <Chip
                icon="cash"
                label={t('inventory.chip.noPrice')}
                empty={!item.salePriceLabel}
              />
            )}
          </View>
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
