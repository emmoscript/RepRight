import type { BiomechanicalError } from '@/modules/analyzer';
import { calculateRepScore } from '@/modules/scoring';
import type { WorkoutSetSnapshot } from '@/store/sessionResultStore';
import { getSetTarget, type SetPlanConfigSlice, type WorkoutSetPlanRow } from '@/utils/setPlan';
import type { WeightUnit } from '@/utils/weightUnits';

export type WorkoutSetResult = {
  setNumber: number;
  reps: number;
  repsPlanned: number;
  weightAmount: number;
  weightUnit: WeightUnit;
  elapsedSec: number;
  formScore: number;
};

/** Frozen at set finish — Session Complete must not read live Zustand (LiveSession can remount/clear). */
export type SessionReviewSnapshot = {
  capturedAt: number;
  startedAt: number;
  currentSetNumber: number;
  lastSetReps: number;
  lastSetElapsedSec: number;
  errors: BiomechanicalError[];
  workoutSetSnapshots: WorkoutSetSnapshot[];
  planSlice: SetPlanConfigSlice;
  weightUnit: WeightUnit;
  exercise: 'conventional_deadlift' | 'other';
  plannedSetCount: number;
};

export type SessionReviewDisplay = SessionReviewSnapshot & {
  completedSetTarget: WorkoutSetPlanRow;
  workoutSetResults: WorkoutSetResult[];
  metrics: ReturnType<typeof buildWorkoutScoreMetrics>;
};

export function buildWorkoutSetResults(
  snapshot: Pick<
    SessionReviewSnapshot,
    | 'workoutSetSnapshots'
    | 'currentSetNumber'
    | 'lastSetReps'
    | 'lastSetElapsedSec'
    | 'planSlice'
    | 'weightUnit'
    | 'errors'
  >,
): WorkoutSetResult[] {
  const bySet = new Map<number, WorkoutSetResult>();
  for (const row of snapshot.workoutSetSnapshots) {
    bySet.set(row.setNumber, {
      setNumber: row.setNumber,
      reps: row.reps,
      repsPlanned: getSetTarget(snapshot.planSlice, row.setNumber).reps,
      weightAmount: row.weightAmount,
      weightUnit: row.weightUnit,
      elapsedSec: row.elapsedSec,
      formScore: row.scoreRounded,
    });
  }
  const completedSetTarget = getSetTarget(snapshot.planSlice, snapshot.currentSetNumber);
  bySet.set(snapshot.currentSetNumber, {
    setNumber: snapshot.currentSetNumber,
    reps: snapshot.lastSetReps,
    repsPlanned: completedSetTarget.reps,
    weightAmount: completedSetTarget.weightAmount,
    weightUnit: snapshot.weightUnit,
    elapsedSec: snapshot.lastSetElapsedSec,
    formScore: Math.round(calculateRepScore(snapshot.errors).score),
  });
  return [...bySet.values()].sort((a, b) => a.setNumber - b.setNumber);
}

export function deriveSessionReviewDisplay(snapshot: SessionReviewSnapshot): SessionReviewDisplay {
  const completedSetTarget = getSetTarget(snapshot.planSlice, snapshot.currentSetNumber);
  const workoutSetResults = buildWorkoutSetResults(snapshot);
  const metrics = buildWorkoutScoreMetrics(workoutSetResults, snapshot.errors);
  return { ...snapshot, completedSetTarget, workoutSetResults, metrics };
}

export function calculateCompletionPct(completed: number, planned: number): number {
  if (planned <= 0) return 100;
  return Math.min(100, Math.round((completed / planned) * 100));
}

/** Performance = form quality scaled by rep completion (100% form × 60% reps → 60%). */
export function calculateOverallScore(formScore: number, completionPct: number): number {
  return Math.round((formScore * completionPct) / 100);
}

export function buildWorkoutScoreMetrics(
  sets: WorkoutSetResult[],
  sessionErrors: BiomechanicalError[],
): {
  formScore: number;
  completionPct: number;
  overallScore: number;
  totalReps: number;
  plannedReps: number;
} {
  const totalReps = sets.reduce((a, s) => a + s.reps, 0);
  const plannedReps = sets.reduce((a, s) => a + s.repsPlanned, 0);
  const formScore = Math.round(calculateRepScore(sessionErrors).score);
  const completionPct = calculateCompletionPct(totalReps, plannedReps);
  const overallScore = calculateOverallScore(formScore, completionPct);
  return { formScore, completionPct, overallScore, totalReps, plannedReps };
}
