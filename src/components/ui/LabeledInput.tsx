import { View, Text, TextInput, type KeyboardTypeOptions } from 'react-native';
import colors from '@/theme/colors';

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
}

/** A labeled text field for forms — label above a bordered input. */
export function LabeledInput({ label, value, onChangeText, placeholder, keyboardType }: LabeledInputProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">{label}</Text>
      <TextInput
        className="bg-background text-ink px-3.5 py-3 rounded-xl border border-border text-sm text-right"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors['slate-400']}
        keyboardType={keyboardType}
      />
    </View>
  );
}
