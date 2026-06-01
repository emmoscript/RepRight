import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { AppLanguage } from '@/i18n/types';

import en from './locales/en.json';
import es from './locales/es.json';

export function deviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? 'en';
  return code.startsWith('es') ? 'es' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export function applyAppLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
}

export default i18n;
