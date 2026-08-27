import * as Localization from 'expo-localization';
import * as Speech from 'expo-speech';

import i18n from '@/i18n';
import type { AppLanguage } from '@/i18n/types';

function resolveAppLanguage(): AppLanguage {
  return i18n.language === 'es' ? 'es' : 'en';
}

/** BCP-47 locale for expo-speech from the in-app language (not device UI default). */
export function speechLocaleForAppLanguage(lang: AppLanguage): string {
  const prefix = lang === 'es' ? 'es' : 'en';
  const match = Localization.getLocales().find((locale) =>
    locale.languageCode?.startsWith(prefix),
  );
  if (match?.languageTag) return match.languageTag;
  return lang === 'es' ? 'es-ES' : 'en-US';
}

/** Speak live form feedback in the user's selected app language. */
export function speakFeedbackMessage(text: string): void {
  const lang = resolveAppLanguage();
  const opts = { language: speechLocaleForAppLanguage(lang) };
  void Speech.stop().then(() => {
    Speech.speak(text, opts);
  });
}
