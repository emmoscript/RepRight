import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSessionOwnerKey } from '@/modules/session';

/** Per-account: set when the user submits the in-app questionnaire. */
const BIOMECH_SURVEY_COMPLETED_PREFIX = '@repright/biomech_survey_completed';

/** Per-account: session count when the modal was last shown. */
const BIOMECH_SURVEY_PROMPTED_PREFIX = '@repright/biomech_survey_prompted_sessions';

/** @deprecated Global keys from older builds — ignored for new per-account logic. */
const LEGACY_COMPLETED_KEY = '@repright/biomech_survey_completed';
const LEGACY_PROMPTED_KEY = '@repright/biomech_survey_prompted_sessions';
const LEGACY_DISMISSED_KEY = '@repright/biomech_survey_dismissed';

async function completedKeyForOwner(): Promise<string> {
  return `${BIOMECH_SURVEY_COMPLETED_PREFIX}:${await getSessionOwnerKey()}`;
}

async function promptedKeyForOwner(): Promise<string> {
  return `${BIOMECH_SURVEY_PROMPTED_PREFIX}:${await getSessionOwnerKey()}`;
}

export async function hasCompletedBiomechSurvey(): Promise<boolean> {
  return (await AsyncStorage.getItem(await completedKeyForOwner())) === '1';
}

/** @deprecated Use hasCompletedBiomechSurvey */
export async function isBiomechSurveyCompleted(): Promise<boolean> {
  return hasCompletedBiomechSurvey();
}

export async function markBiomechSurveyCompleted(): Promise<void> {
  await AsyncStorage.setItem(await completedKeyForOwner(), '1');
}

export async function shouldShowBiomechSurveyPrompt(sessionCount: number): Promise<boolean> {
  if (sessionCount < 1) return false;
  if (await hasCompletedBiomechSurvey()) return false;
  const raw = await AsyncStorage.getItem(await promptedKeyForOwner());
  const prompted = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(prompted) || prompted < 0) return true;
  return sessionCount > prompted;
}

export async function markBiomechSurveyPrompted(sessionCount: number): Promise<void> {
  await AsyncStorage.setItem(await promptedKeyForOwner(), String(sessionCount));
}

/** Dev / QA — clear survey flags for the active account on this device. */
export async function resetBiomechSurveyState(): Promise<void> {
  await AsyncStorage.multiRemove([
    await completedKeyForOwner(),
    await promptedKeyForOwner(),
    LEGACY_COMPLETED_KEY,
    LEGACY_PROMPTED_KEY,
    LEGACY_DISMISSED_KEY,
  ]);
}
