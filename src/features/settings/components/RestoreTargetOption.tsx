import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface RestoreTargetOptionProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}

/** One pickable row in the "what do you want to restore?" step. */
export function RestoreTargetOption({ icon, label, hint, onPress }: RestoreTargetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`${ROW} items-center gap-3 rounded-2xl border border-border bg-background p-3.5 active:opacity-80`}
    >
      <View className="w-9 h-9 rounded-xl bg-primary-light items-center justify-center">
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-ink text-right">{label}</Text>
        <Text className="text-xs text-muted text-right leading-5">{hint}</Text>
      </View>
    </Pressable>
  );
}
