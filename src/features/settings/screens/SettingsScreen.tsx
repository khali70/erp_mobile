import { View, Text, Switch, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSettingsStore } from '@/store/settings-store';

/**
 * الإعدادات — device settings. Step-1 surfaces the negative-stock policy flag
 * (persisted to MMKV via settings-store). Composition-only; NativeWind styling.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);
  const setAllowNegativeStock = useSettingsStore((s) => s.setAllowNegativeStock);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="gap-3 pb-24">
        <Text className="text-xs font-bold text-muted px-1">{t('settings.stock.section')}</Text>

        <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-ink text-right">
              {t('settings.negativeStock.label')}
            </Text>
            <Text className="text-xs text-muted text-right leading-5">
              {t('settings.negativeStock.hint')}
            </Text>
          </View>
          <Switch
            value={allowNegativeStock}
            onValueChange={setAllowNegativeStock}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('settings.negativeStock.label')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
