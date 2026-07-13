import { View, Text } from 'react-native';
import { MaskedValue } from '@/components/ui/MaskedValue';

interface DebtBadgeProps {
  label: string;
  /** True when a balance is outstanding (warning color); false = settled (muted). */
  active: boolean;
  /**
   * Mask key. Present → the label is a money balance and gets masked under
   * privacy mode. Omit for non-money labels (e.g. "settled").
   */
  maskId?: string;
}

/** Pill showing a party's outstanding balance, amber when owed, muted when settled. */
export function DebtBadge({ label, active, maskId }: DebtBadgeProps) {
  const box = active ? 'bg-warning-light border-amber-100' : 'bg-background border-border';
  const text = active ? 'text-warning' : 'text-muted';
  const labelNode = <Text className={`text-[11px] font-medium ${text}`}>{label}</Text>;
  return (
    <View className={`px-2.5 py-1 rounded-lg border ${box}`}>
      {maskId ? (
        <MaskedValue
          id={maskId}
          dotClassName="text-[11px] font-medium text-muted"
          iconSize={11}
          dotCount={4}
        >
          {labelNode}
        </MaskedValue>
      ) : (
        labelNode
      )}
    </View>
  );
}
