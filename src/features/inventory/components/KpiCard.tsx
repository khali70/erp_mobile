import { View, Text, Pressable } from 'react-native';
import { ROW } from '@/theme/rtl';
import { MaskedValue } from '@/components/ui/MaskedValue';

interface KpiCardProps {
  /** Mask key for this figure, e.g. `kpi:stockValue`. */
  valueId: string;
  dotClass: string;
  label: string;
  valueText: string;
  currency: string;
  tagText: string;
  tagTextClass: string;
  tagBgClass: string;
  onPress?: () => void;
}

/** Dashboard KPI tile: label, money figure (maskable), and a status tag. */
export function KpiCard({
  valueId,
  dotClass,
  label,
  valueText,
  currency,
  tagText,
  tagTextClass,
  tagBgClass,
  onPress,
}: KpiCardProps) {
  return (
    <Pressable
      className="grow basis-[46%] bg-surface rounded-[20px] p-4 border border-border"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className={`${ROW} items-center gap-1.5 mb-2.5`}>
        <View className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <Text className="text-xs text-muted font-medium">{label}</Text>
      </View>
      <MaskedValue id={valueId} dotClassName="text-lg font-extrabold text-muted" iconSize={15}>
        <Text className="text-lg font-extrabold text-ink text-right">
          {valueText} <Text className="text-xs font-normal text-muted">{currency}</Text>
        </Text>
      </MaskedValue>
      {/* No tag means NO PILL. A month with no sales has no margin to report, and
          the empty string it passes was still painting a blank coloured chip —
          a badge that says nothing, in the colour of good news. */}
      {tagText ? (
        <View className={`self-end mt-1.5 px-2 py-0.5 rounded-md ${tagBgClass}`}>
          <Text className={`text-[10px] font-semibold ${tagTextClass}`}>{tagText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
