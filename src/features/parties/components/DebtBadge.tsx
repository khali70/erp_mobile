import { View, Text } from 'react-native';

interface DebtBadgeProps {
  label: string;
  /** True when a balance is outstanding (warning color); false = settled (muted). */
  active: boolean;
}

/** Pill showing a party's outstanding balance, amber when owed, muted when settled. */
export function DebtBadge({ label, active }: DebtBadgeProps) {
  const box = active ? 'bg-warning-light border-amber-100' : 'bg-background border-border';
  const text = active ? 'text-warning' : 'text-muted';
  return (
    <View className={`px-2.5 py-1 rounded-lg border ${box}`}>
      <Text className={`text-[11px] font-medium ${text}`}>{label}</Text>
    </View>
  );
}
