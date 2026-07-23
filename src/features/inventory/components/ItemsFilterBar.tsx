import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { SearchBar } from '@/components/ui/SearchBar';

interface ItemsFilterBarProps {
  query: string;
  onChangeQuery: (value: string) => void;
  onScan: () => void;
  /** True when ANY filter (search, stock chip, advanced) is on. */
  anyActive: boolean;
  onClearAll: () => void;
}

/** Search + barcode scan + the advanced-filter button, with a clear-all escape. */
export function ItemsFilterBar({
  query,
  onChangeQuery,
  onScan,
  anyActive,
  onClearAll,
}: ItemsFilterBarProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-2.5">
      <View className={`${ROW} items-center gap-2.5`}>
        <View className="flex-1">
          <SearchBar
            value={query}
            onChangeText={onChangeQuery}
            placeholder={t('inventory.searchPlaceholder')}
          />
        </View>
        <Pressable
          className="w-12 h-12 rounded-2xl items-center justify-center bg-primary"
          onPress={onScan}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.scan')}
        >
          <MaterialCommunityIcons name="barcode-scan" size={20} color={colors.surface} />
        </Pressable>
      </View>

      <View className={`${ROW} items-center gap-2.5`}>
        {anyActive && (
          <Pressable
            className={`${ROW} items-center gap-1.5`}
            onPress={onClearAll}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Feather name="x-circle" size={14} color={colors.muted} />
            <Text className="text-xs font-bold text-muted underline">
              {t('inventory.advancedFilters.clearAll')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
