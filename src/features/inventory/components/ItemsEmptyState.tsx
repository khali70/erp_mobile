import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

interface ItemsEmptyStateProps {
  /** True when filters are what emptied the list (vs. an empty catalogue). */
  filtered: boolean;
  onReset: () => void;
}

/**
 * Two different silences: a catalogue with nothing in it yet, and a catalogue
 * hidden behind filters. Only the second one offers a reset — telling an owner
 * with zero items to "reset filters" would just be wrong.
 */
export function ItemsEmptyState({ filtered, onReset }: ItemsEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
      <Feather name={filtered ? 'filter' : 'package'} size={44} color={colors['slate-400']} />
      <Text className="text-muted text-sm text-center">
        {filtered ? t('inventory.empty.noMatch') : t('inventory.empty.message')}
      </Text>
      {filtered && (
        <Pressable onPress={onReset} accessibilityRole="button">
          <Text className="text-xs text-primary font-bold underline">
            {t('inventory.empty.reset')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
