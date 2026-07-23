import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface RestoreRowProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * The Settings row for restore — same card shape as the backup row above it,
 * deliberately NOT the same colour. Backup is the safe, encouraged action and
 * wears the primary token; restore erases everything on the phone and wears
 * `danger`, so the two are never confused at a glance in a hurry.
 */
export function RestoreRow({ onPress, disabled = false }: RestoreRowProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
      <View className="gap-1">
        <Text className="text-sm font-bold text-ink text-right">{t('settings.restore.label')}</Text>
        <Text className="text-xs text-muted text-right leading-5">{t('settings.restore.hint')}</Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('settings.restore.button')}
        accessibilityState={{ disabled }}
        className={`${ROW} items-center justify-center gap-2 rounded-xl border border-danger py-3 active:opacity-80`}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <Feather name="upload" size={18} color={colors.danger} />
        <Text className="text-sm font-bold text-danger">{t('settings.restore.button')}</Text>
      </Pressable>
    </View>
  );
}
