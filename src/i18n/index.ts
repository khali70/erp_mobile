import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import ar from './locales/ar.json';
import en from './locales/en.json';

export const resources = {
  ar: { translation: ar },
  en: { translation: en },
} as const;

export const RTL_LANGS = ['ar'];

// Device language, fallback to Arabic (Arabic-first product).
const deviceLang = getLocales()[0]?.languageCode ?? 'ar';
const lng = deviceLang in resources ? deviceLang : 'ar';

// Force RTL layout when active language is RTL.
const isRTL = RTL_LANGS.includes(lng);
I18nManager.allowRTL(true);
if (I18nManager.isRTL !== isRTL) {
  I18nManager.forceRTL(isRTL);
}

i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
