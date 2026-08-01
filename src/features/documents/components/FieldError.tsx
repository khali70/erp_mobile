import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface FieldErrorProps {
  message: string;
}

/** Inline, non-blocking validation message under a form field (trailing-aligned). */
export function FieldError({ message }: FieldErrorProps) {
  return (
    <View className={`${ROW} items-center gap-1.5 justify-end`}>
      <Text className="text-danger text-[11px] font-bold text-right">{message}</Text>
      <Feather name="alert-triangle" size={12} color={colors.danger} />
    </View>
  );
}
