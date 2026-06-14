import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BIOMECH_SURVEY_VERSION,
  type BiomechSurveyAnswer,
  scoreBiomechAnswers,
  type SurveyOptionId,
} from '@/content/biomechSurvey';
import { markBiomechSurveyCompleted } from '@/constants/researchSurvey';
import { getSessionOwnerKey } from '@/modules/session';
import { getResearchSessionCount } from '@/lib/researchSessionCount';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';

const GUEST_CLIENT_KEY = '@repright/guest_client_id';

export type SubmitBiomechSurveyResult =
  | { ok: true; score: number; alreadySubmitted: boolean }
  | { ok: false; error: 'offline' | 'submit_failed' };

async function guestClientId(): Promise<string | null> {
  const id = await AsyncStorage.getItem(GUEST_CLIENT_KEY);
  return id?.trim() || null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function submitBiomechSurvey(
  answers: Record<string, SurveyOptionId | undefined>,
  email: string,
): Promise<SubmitBiomechSurveyResult> {
  const { score, payload } = scoreBiomechAnswers(answers);
  const ownerKey = await getSessionOwnerKey();
  const trimmedEmail = email.trim();

  if (!isSupabaseConfigured()) {
    if (__DEV__) {
      await markBiomechSurveyCompleted();
      return { ok: true, score, alreadySubmitted: false };
    }
    return { ok: false, error: 'offline' };
  }

  const { isLoggedIn, isGuest, user } = useAuthStore.getState();
  const clientId = isGuest || !isLoggedIn ? await guestClientId() : null;

  if (!isLoggedIn && !clientId) {
    return { ok: false, error: 'submit_failed' };
  }

  if (isLoggedIn && !trimmedEmail && !user?.email?.trim()) {
    return { ok: false, error: 'submit_failed' };
  }

  const sessionCount = await getResearchSessionCount();

  const { data, error } = await supabase.rpc('submit_biomech_survey', {
    p_owner_key: ownerKey,
    p_client_id: clientId,
    p_email: isLoggedIn ? user?.email?.trim() ?? trimmedEmail : trimmedEmail,
    p_survey_version: BIOMECH_SURVEY_VERSION,
    p_answers: payload as unknown as BiomechSurveyAnswer[],
    p_score: score,
    p_session_count: sessionCount,
  });

  if (error) {
    if (__DEV__) console.warn('[biomechSurvey] submit failed', error.message);
    return { ok: false, error: 'submit_failed' };
  }

  const row = data as { score?: number; already_submitted?: boolean } | null;
  const finalScore = typeof row?.score === 'number' ? row.score : score;
  const alreadySubmitted = row?.already_submitted === true;

  await markBiomechSurveyCompleted();
  return { ok: true, score: finalScore, alreadySubmitted };
}

export { isValidEmail };
