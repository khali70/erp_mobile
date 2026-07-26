import { View, Text } from 'react-native';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { NumericInput } from '@/components/ui/NumericInput';

interface PriceRangeInputProps {
  /** Raw text of the lower bound — MAJOR units (EGP) for money ranges. */
  minValue: string;
  /** Raw text of the upper bound. */
  maxValue: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
  /** Short captions above each box, e.g. "From" / "To". */
  minLabel: string;
  maxLabel: string;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  /** Unit shown after both captions, e.g. the currency code. */
  suffix?: string;
}

/**
 * A min/max numeric pair. Bounds are optional on both sides — a blank box means
 * "unbounded", which is why this is two plain fields and not a slider (the shop
 * has no fixed price ceiling to slide against).
 *
 * The value stays a raw string: parsing/major→minor conversion belongs to the
 * filter util, not to an input that must let a half-typed "12." exist.
 */
export function PriceRangeInput({
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  minLabel,
  maxLabel,
  minPlaceholder,
  maxPlaceholder,
  suffix,
}: PriceRangeInputProps) {
  const caption = (label: string) => (suffix ? `${label} · ${suffix}` : label);

  return (
    <View className={`${ROW} gap-3`}>
      <View className="flex-1 gap-1">
        <Text className="text-[11px] text-muted text-right">{caption(minLabel)}</Text>
        <NumericInput
          className="bg-background text-ink px-3.5 py-2.5 rounded-xl border border-border text-sm text-right"
          value={minValue}
          onChangeText={onChangeMin}
          placeholder={minPlaceholder}
          placeholderTextColor={colors['slate-400']}
          keyboardType="numeric"
          accessibilityLabel={caption(minLabel)}
        />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[11px] text-muted text-right">{caption(maxLabel)}</Text>
        <NumericInput
          className="bg-background text-ink px-3.5 py-2.5 rounded-xl border border-border text-sm text-right"
          value={maxValue}
          onChangeText={onChangeMax}
          placeholder={maxPlaceholder}
          placeholderTextColor={colors['slate-400']}
          keyboardType="numeric"
          accessibilityLabel={caption(maxLabel)}
        />
      </View>
    </View>
  );
}
