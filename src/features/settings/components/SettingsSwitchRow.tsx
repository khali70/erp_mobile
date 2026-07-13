import { View, Text, Switch } from 'react-native';
import colors from '@/theme/colors';

interface SettingsSwitchRowProps {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Dimmed + inert, e.g. a sub-setting whose parent switch is off. */
  disabled?: boolean;
}

/** One settings card: label + hint on one side, a switch on the other. */
export function SettingsSwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled = false,
}: SettingsSwitchRowProps) {
  return (
    <View
      className="bg-surface rounded-2xl p-4 border border-border flex-row items-start justify-between gap-4"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View className="flex-1 gap-1">
        <Text className="text-sm font-bold text-ink text-right">{label}</Text>
        <Text className="text-xs text-muted text-right leading-5">{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      />
    </View>
  );
}
