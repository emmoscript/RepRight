import { mergeCloudSessions, type SessionLog } from '@/modules/session';
import { supabase } from '@/lib/supabaseClient';
import type { BiomechanicalError, WorkoutSession } from '@/lib/supabaseTypes';
import { useAuthStore } from '@/store/authStore';
import type { WeightUnit } from '@/utils/weightUnits';

type CloudSessionRow = WorkoutSession & {
  biomechanical_errors?: BiomechanicalError[] | null;
};

const PULL_COOLDOWN_MS = 60_000;
let lastPullAt = 0;
let pullInFlight: Promise<number> | null = null;

function topErrorType(errors: BiomechanicalError[]): string | null {
  if (errors.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of errors) {
    counts.set(e.error_type, (counts.get(e.error_type) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

function cloudRowToSessionLog(row: CloudSessionRow, participantId: string): SessionLog {
  const errors = row.biomechanical_errors ?? [];
  const formScore = row.form_score ?? row.avg_score ?? 0;
  const completionPct = row.completion_pct ?? 100;
  const avgScore = row.avg_score ?? formScore;
  const totalReps = row.total_reps ?? 0;
  const plannedReps = totalReps > 0 ? totalReps : row.set_count;
  const weightUnit: WeightUnit = row.weight_unit === 'kg' ? 'kg' : 'lb';
  const startedMs = new Date(row.started_at).getTime();
  const endedMs = row.completed_at
    ? new Date(row.completed_at).getTime()
    : startedMs + 60_000;
  const repsPerSet = row.set_count > 0 ? Math.max(1, Math.round(totalReps / row.set_count)) : 1;

  const setSummaries = Array.from({ length: Math.max(1, row.set_count) }, (_, i) => ({
    setNumber: i + 1,
    repsCompleted: repsPerSet,
    repsPlanned: repsPerSet,
    weightAmount: row.weight ?? 0,
    weightUnit,
    elapsedSec: Math.max(0, Math.round((endedMs - startedMs) / 1000)),
    formScore: Math.round(formScore),
  }));

  return {
    sessionId: row.id,
    participantId,
    date: row.started_at,
    exercise: row.exercise,
    setSummaries,
    sets: setSummaries.map((st) => ({
      setNumber: st.setNumber,
      reps: [
        {
          repNumber: 1,
          startTimestamp: startedMs,
          endTimestamp: endedMs,
          score: st.formScore,
          errors: [],
        },
      ],
    })),
    summary: {
      totalReps,
      plannedReps,
      formScore: Math.round(formScore),
      completionPct: Math.round(completionPct),
      avgScore: Math.round(avgScore),
      mostFrequentError: topErrorType(errors),
    },
  };
}

/**
 * Fetch workout_sessions from Supabase and merge into local AsyncStorage.
 * Skips rows that match an existing local session (same cloud id or started_at + exercise).
 */
export async function pullAndMergeCloudSessions(userId?: string): Promise<number> {
  const uid = userId ?? useAuthStore.getState().user?.id;
  if (!uid || !useAuthStore.getState().isLoggedIn) return 0;

  const now = Date.now();
  if (now - lastPullAt < PULL_COOLDOWN_MS && pullInFlight) {
    return pullInFlight;
  }

  pullInFlight = (async () => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*, biomechanical_errors(*)')
      .order('started_at', { ascending: false });

    if (error) {
      if (__DEV__) console.warn('[pullSessions] fetch failed', error.message);
      return 0;
    }

    const rows = (data ?? []) as CloudSessionRow[];
    if (rows.length === 0) return 0;

    const participantId =
      useAuthStore.getState().user?.email?.trim() || useAuthStore.getState().participantId;

    const imports = rows.map((row) => cloudRowToSessionLog(row, participantId));
    const added = await mergeCloudSessions(imports);
    lastPullAt = Date.now();

    if (__DEV__ && added > 0) {
      console.log(`[pullSessions] merged ${added} session(s) from cloud`);
    }

    return added;
  })();

  try {
    return await pullInFlight;
  } finally {
    pullInFlight = null;
  }
}
