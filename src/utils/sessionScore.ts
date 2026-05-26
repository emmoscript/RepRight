import type { BiomechanicalError } from '@/modules/analyzer';
import { calculateRepScore } from '@/modules/scoring';
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
