import { View, Text } from 'react-native';

/** Circular avatar showing the party's first initial. */
export function PartyAvatar({ initial }: { initial: string }) {
  return (
    <View className="w-12 h-12 rounded-full items-center justify-center bg-primary-light border border-border">
      <Text className="text-base font-bold text-primary">{initial}</Text>
    </View>
  );
}
