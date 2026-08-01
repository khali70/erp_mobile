import { View, Text, Pressable, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { DEVELOPER_INFO, developerText, type DeveloperContact } from '../developer-info';

/**
 * The "About" Settings section: app name + version, then who built it.
 *
 * Presentational only — its content comes from `developer-info.ts` (the credit)
 * and app.json (the version, read through expo-constants), so nothing here has
 * to be edited when either changes.
 */
export function AboutSection() {
  const { t, i18n } = useTranslation();
  const version = Constants.expoConfig?.version ?? '—';
  const appName = Constants.expoConfig?.name ?? 'Rafuf';

  const openContact = (contact: DeveloperContact) => {
    // A phone with no mail client (or no dialer) rejects the URL; the credit is
    // informational, so a failed tap stays silent rather than alerting.
    Linking.openURL(contact.url).catch(() => {});
  };

  return (
    <>
      <Text className="text-xs font-bold text-muted px-1 mt-3">{t('settings.about.section')}</Text>

      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row-reverse items-center justify-between">
          <Text className="text-sm font-bold text-ink">{appName}</Text>
          <Text className="text-xs text-muted" style={{ writingDirection: 'ltr' }}>
            {t('settings.about.version', { version })}
          </Text>
        </View>

        <View className="h-px bg-border" />

        <View className="gap-1">
          <Text className="text-[11px] font-bold text-muted text-right">
            {t('settings.about.developedBy')}
          </Text>
          <Text className="text-sm font-bold text-ink text-right">
            {developerText(DEVELOPER_INFO.name, i18n.language)}
          </Text>
          <Text className="text-xs text-muted text-right leading-5">
            {developerText(DEVELOPER_INFO.title, i18n.language)}
          </Text>
        </View>

        {DEVELOPER_INFO.contacts.map((contact) => (
          <Pressable
            key={contact.url}
            onPress={() => openContact(contact)}
            accessibilityRole="link"
            accessibilityLabel={contact.value}
            className="flex-row-reverse items-center gap-2 rounded-xl border border-border px-3 py-2 active:opacity-70"
          >
            <Feather name={contact.icon} size={16} color={colors.muted} />
            <Text className="flex-1 text-xs text-ink text-right" style={{ writingDirection: 'ltr' }}>
              {contact.value}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
