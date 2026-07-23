import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { bidiIsolate } from '@/utils/numerals';

interface ContactSuggestionRowProps {
  name: string;
  /** null = the contact has no number; the row says so instead of showing a gap. */
  phone: string | null;
  noPhoneLabel: string;
  onPress: () => void;
}

/**
 * One device contact in the name-field dropdown. Presentational only.
 *
 * The number is bidi-isolated: a Latin-digit phone dropped into an RTL row
 * otherwise reorders around the name and reads back wrong.
 */
export function ContactSuggestionRow({ name, phone, noPhoneLabel, onPress }: ContactSuggestionRowProps) {
  return (
    <Pressable
      className={`${ROW} items-center gap-3 px-3 py-2.5`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={phone ? `${name} — ${phone}` : name}
    >
      <View className="w-8 h-8 rounded-full bg-primary-light items-center justify-center">
        <Feather name="user" size={15} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-ink text-sm font-bold text-right" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-muted text-xs text-right mt-0.5" numberOfLines={1}>
          {phone ? bidiIsolate(phone) : noPhoneLabel}
        </Text>
      </View>
      <Feather name="plus-circle" size={16} color={colors.primary} />
    </Pressable>
  );
}
