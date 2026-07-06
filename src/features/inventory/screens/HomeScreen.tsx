import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export function HomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-5 pt-6">
        <Text className="text-2xl font-bold text-text">{t('home.title')}</Text>
        <Text className="mt-1 text-base text-text-muted">
          {t('home.subtitle')}
        </Text>

        <View className="mt-8 gap-3">
          <Pressable className="rounded-2xl bg-primary px-5 py-4 active:opacity-80">
            <Text className="text-center text-base font-semibold text-primary-fg">
              {t('home.items')}
            </Text>
          </Pressable>
          <Pressable className="rounded-2xl bg-bg-muted px-5 py-4 active:opacity-80">
            <Text className="text-center text-base font-semibold text-text">
              {t('home.newDocument')}
            </Text>
          </Pressable>
        </View>

        <Text className="mt-auto pb-4 text-center text-xs text-text-muted">
          {t('home.footer')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
