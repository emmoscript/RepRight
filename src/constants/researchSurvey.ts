import AsyncStorage from '@react-native-async-storage/async-storage';

export const BIOMECH_SURVEY_URL = 'https://forms.gle/vNRanGoQmRpj7AyM9';

/** Set when the user taps "Take questionnaire" — never prompt again. */
export const BIOMECH_SURVEY_COMPLETED_KEY = '@repright/biomech_survey_completed';

/** Session count when the prompt was last shown (snooze until a newer session). */
export const BIOMECH_SURVEY_PROMPTED_SESSIONS_KEY = '@repright/biomech_survey_prompted_sessions';

/** @deprecated Legacy key — treated as completed for upgrades. */
const BIOMECH_SURVEY_DISMISSED_KEY = '@repright/biomech_survey_dismissed';

export async function isBiomechSurveyCompleted(): Promise<boolean> {
  const completed = await AsyncStorage.getItem(BIOMECH_SURVEY_COMPLETED_KEY);
  if (completed === '1') return true;
  const legacy = await AsyncStorage.getItem(BIOMECH_SURVEY_DISMISSED_KEY);
  return legacy === '1';
}

export async function markBiomechSurveyCompleted(): Promise<void> {
  await AsyncStorage.setItem(BIOMECH_SURVEY_COMPLETED_KEY, '1');
  await AsyncStorage.removeItem(BIOMECH_SURVEY_DISMISSED_KEY);
}

export async function shouldShowBiomechSurveyPrompt(sessionCount: number): Promise<boolean> {
  if (sessionCount < 1) return false;
  if (await isBiomechSurveyCompleted()) return false;
  const raw = await AsyncStorage.getItem(BIOMECH_SURVEY_PROMPTED_SESSIONS_KEY);
  const prompted = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(prompted) || prompted < 0) return true;
  return sessionCount > prompted;
}

export async function markBiomechSurveyPrompted(sessionCount: number): Promise<void> {
  await AsyncStorage.setItem(BIOMECH_SURVEY_PROMPTED_SESSIONS_KEY, String(sessionCount));
}
