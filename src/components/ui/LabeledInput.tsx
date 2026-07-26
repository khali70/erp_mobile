import type { ReactNode } from 'react';
import { View, Text, TextInput, type KeyboardTypeOptions } from 'react-native';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { NumericInput } from '@/components/ui/NumericInput';

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  /** Field focus — e.g. the party form asks for contacts permission here. */
  onFocus?: () => void;
  /** Optional control pinned to the far end of the LABEL row (not the input). */
  accessory?: ReactNode;
}

/** A labeled text field for forms — label above a bordered input. */
export function LabeledInput({ label, value, onChangeText, placeholder, keyboardType, multiline, editable = true, onFocus, accessory }: LabeledInputProps) {
  // Numeric fields route through NumericInput to gain quick-math (`*`/`/`) support.
  // A numeric field is never multiline, and NumericInput has no multiline mode, so
  // text/multiline fields stay on the plain TextInput untouched.
  const isMath = !multiline && (keyboardType === 'numeric' || keyboardType === 'decimal-pad');
  const className = `bg-background text-ink px-3.5 py-3 rounded-xl border border-border text-sm text-right ${multiline ? 'h-20' : ''}`;

  return (
    <View className="gap-1.5">
      <View className={`${ROW} items-center justify-between`}>
        <Text className="flex-1 text-xs font-semibold text-muted text-right">{label}</Text>
        {accessory}
      </View>
      {isMath ? (
        <NumericInput
          className={className}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors['slate-400']}
          keyboardType={keyboardType}
          editable={editable !== false}
          onFocus={onFocus}
        />
      ) : (
        <TextInput
          className={className}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors['slate-400']}
          keyboardType={keyboardType}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          editable={editable !== false}
          onFocus={onFocus}
        />
      )}
    </View>
  );
}
