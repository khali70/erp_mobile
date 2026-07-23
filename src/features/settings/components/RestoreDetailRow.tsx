import { View, Text } from 'react-native';
import { ROW } from '@/theme/rtl';

interface RestoreDetailRowProps {
  label: string;
  value: string;
}

/** One `label — value` line of the picked file's details. */
export function RestoreDetailRow({ label, value }: RestoreDetailRowProps) {
  return (
    <View className={`${ROW} items-start justify-between gap-3`}>
      <Text className="text-xs text-muted">{label}</Text>
      {/* `shrink` + LTR-safe alignment: file names are Latin inside RTL copy. */}
      <Text className="text-xs font-semibold text-ink flex-1 text-left" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
