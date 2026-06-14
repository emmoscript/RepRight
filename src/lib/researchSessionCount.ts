import { getAllSessions } from '@/modules/session';
import { pullAndMergeCloudSessions } from '@/lib/pullSessionsFromSupabase';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';

async function cloudWorkoutSessionCount(): Promise<number | null> {
  const { isLoggedIn } = useAuthStore.getState();
  if (!isLoggedIn || !isSupabaseConfigured()) return null;

  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true });

  if (error) {
    if (__DEV__) console.warn('[researchSessionCount] cloud count failed', error.message);
    return null;
  }

  return typeof count === 'number' ? count : null;
}

/**
 * Session count for research payloads — merges local logs with cloud when signed in.
 */
export async function getResearchSessionCount(): Promise<number> {
  const { isLoggedIn } = useAuthStore.getState();

  if (isLoggedIn) {
    await pullAndMergeCloudSessions();
  }

  const localCount = (await getAllSessions()).length;
  const cloudCount = await cloudWorkoutSessionCount();

  if (cloudCount == null) return localCount;
  return Math.max(localCount, cloudCount);
}
