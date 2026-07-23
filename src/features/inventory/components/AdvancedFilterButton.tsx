import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';

interface AdvancedFilterButtonProps {
  /** How many advanced dimensions are constrained; 0 hides the badge. */
  count: number;
  onPress: () => void;
}

/** Opens the advanced-filter sheet; turns primary and shows a count when active. */
export function AdvancedFilterButton({ count, onPress }: AdvancedFilterButtonProps) {
  const { t, i18n } = useTranslation();
  const active = count > 0;

  return (
    <Pressable
      className={`${ROW} items-center gap-2 px-3.5 h-12 rounded-2xl border ${
        active ? 'bg-primary border-transparent' : 'bg-surface border-border'
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        active
          ? `${t('inventory.advancedFilters.button')} — ${t('inventory.advancedFilters.activeCount', { count })}`
          : t('inventory.advancedFilters.button')
      }
    >
      <Feather name="sliders" size={17} color={active ? colors.surface : colors.muted} />
      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
        {t('inventory.advancedFilters.button')}
      </Text>
      {active && (
        <View className="min-w-[18px] h-[18px] px-1 rounded-full bg-white items-center justify-center">
          <Text className="text-[10px] font-bold text-primary">
            {formatNumber(count, i18n.language)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
