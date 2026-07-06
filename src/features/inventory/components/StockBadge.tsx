import { View, Text } from 'react-native';
import type { StockStatus } from '@/utils/stock';

// Status → (bg + border, text color). Colors carry meaning: green=in, amber=low,
// red=out — consistent with the KPI/dashboard palette.
const STATUS_STYLE: Record<StockStatus, { box: string; text: string }> = {
  inStock: { box: 'bg-positive-light border-emerald-100', text: 'text-positive' },
  low: { box: 'bg-warning-light border-amber-100', text: 'text-warning' },
  out: { box: 'bg-danger-light border-rose-100', text: 'text-danger' },
};

interface StockBadgeProps {
  status: StockStatus;
  label: string;
}

/** Pill showing on-hand quantity, colored by stock status. */
export function StockBadge({ status, label }: StockBadgeProps) {
  const style = STATUS_STYLE[status];
  return (
    <View className={`px-2.5 py-1 rounded-lg border ${style.box}`}>
      <Text className={`text-[11px] font-medium ${style.text}`}>{label}</Text>
    </View>
  );
}
