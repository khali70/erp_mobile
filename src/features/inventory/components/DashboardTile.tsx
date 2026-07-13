import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

interface DashboardTileProps {
  icon: ReactNode;
  iconBgClass: string;
  label: string;
  /** Optional count bubble (documents, low-stock items). Never money. */
  badgeText?: string;
  onPress?: () => void;
}

/** Section shortcut tile on the dashboard grid. */
export function DashboardTile({
  icon,
  iconBgClass,
  label,
  badgeText,
  onPress,
}: DashboardTileProps) {
  return (
    <Pressable
      className="grow basis-[30%] bg-surface rounded-2xl p-3 border border-border items-center gap-2"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {!!badgeText && (
        <View className="absolute -top-1.5 -left-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-danger border-2 border-surface items-center justify-center z-10">
          <Text className="text-white text-[10px] font-bold">{badgeText}</Text>
        </View>
      )}
      <View className={`w-11 h-11 rounded-xl items-center justify-center ${iconBgClass}`}>
        {icon}
      </View>
      <Text className="text-xs font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}
