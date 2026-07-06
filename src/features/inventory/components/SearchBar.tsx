import { View, TextInput, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onScanPress?: () => void;
  scanLabel?: string;
}

/** Search field with a leading search glyph and an optional trailing scan action. */
export function SearchBar({ value, onChangeText, placeholder, onScanPress, scanLabel }: SearchBarProps) {
  return (
    <View className="relative w-full">
      <View className="absolute inset-y-0 right-3 justify-center z-10">
        <Feather name="search" size={18} color={colors['slate-400']} />
      </View>
      <TextInput
        className="w-full bg-surface text-ink pr-10 pl-10 py-3 rounded-2xl border border-border text-sm text-right"
        placeholder={placeholder}
        placeholderTextColor={colors['slate-400']}
        value={value}
        onChangeText={onChangeText}
      />
      {onScanPress && (
        <Pressable
          className="absolute inset-y-0 left-3 justify-center z-10"
          onPress={onScanPress}
          accessibilityRole="button"
          accessibilityLabel={scanLabel}
        >
          <Feather name="maximize" size={18} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}
