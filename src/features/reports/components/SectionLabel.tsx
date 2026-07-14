import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface SectionLabelProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
}

/** Small heading above a group of rows (الفواتير / المدفوعات). */
export function SectionLabel({ title, icon }: SectionLabelProps) {
  return (
    <View className={`${ROW} items-center gap-2 mt-1`}>
      <Feather name={icon} size={13} color={colors.muted} />
      <Text className="text-muted text-xs font-bold">{title}</Text>
    </View>
  );
}
