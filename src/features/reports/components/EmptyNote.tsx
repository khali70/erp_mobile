import { View, Text } from 'react-native';

interface EmptyNoteProps {
  message: string;
}

/** A quiet "there is nothing here" card — used for both الفواتير and المدفوعات. */
export function EmptyNote({ message }: EmptyNoteProps) {
  return (
    <View className="bg-surface rounded-2xl p-5 border border-border items-center">
      <Text className="text-muted text-xs text-center">{message}</Text>
    </View>
  );
}
