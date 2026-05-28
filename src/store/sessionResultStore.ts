import { create } from 'zustand';

import type { BiomechanicalError } from '@/modules/analyzer';
import type { SessionReviewSnapshot } from '@/utils/sessionScore';
import type { WeightUnit } from '@/utils/weightUnits';

export type WorkoutSetSnapshot = {
  setNumber: number;
  weightAmount: number;
  weightUnit: WeightUnit;
  reps: number;
  elapsedSec: number;
  scoreRounded: number;
};

type SessionResultState = {
  startedAt: number;
  errors: BiomechanicalError[];
  /** Captured when ending live session (for summary UI). */
  lastSetReps: number;
  lastSetElapsedSec: number;
  /** 1-based label for HUD + Session Complete (“set X of planned”). */
  currentSetNumber: number;
  /** Finished sets earlier in this workout row (shown before advancing). */
  workoutSetSnapshots: WorkoutSetSnapshot[];
  /** Immutable summary for Session Complete (survives LiveSession remount / clearResults races). */
  sessionReview: SessionReviewSnapshot | null;
  setStartedAt: (t: number) => void;
  addErrors: (e: BiomechanicalError[]) => void;
  setLastSetSummary: (reps: number, elapsedSec: number) => void;
  setSessionReview: (review: SessionReviewSnapshot) => void;
  appendWorkoutSetSnapshot: (row: WorkoutSetSnapshot) => void;
  /** After reviewing a completed set — start the next Live screen without wiping workout progress. */
  advanceToNextSet: () => void;
  clear: () => void;
};

export const useSessionResultStore = create<SessionResultState>((set) => ({
  startedAt: Date.now(),
  errors: [],
  lastSetReps: 0,
  lastSetElapsedSec: 0,
  currentSetNumber: 1,
  workoutSetSnapshots: [],
  sessionReview: null,
  setStartedAt: (t) => set({ startedAt: t }),
  addErrors: (e) => set((s) => ({ errors: s.errors.concat(e) })),
  setLastSetSummary: (reps, elapsedSec) => set({ lastSetReps: reps, lastSetElapsedSec: elapsedSec }),
  setSessionReview: (review) => set({ sessionReview: review }),
  appendWorkoutSetSnapshot: (row) =>
    set((s) => {
      const rest = s.workoutSetSnapshots.filter((x) => x.setNumber !== row.setNumber);
      return { workoutSetSnapshots: [...rest, row].sort((a, b) => a.setNumber - b.setNumber) };
    }),
  advanceToNextSet: () =>
    set((s) => ({
      currentSetNumber: s.currentSetNumber + 1,
      errors: [],
      lastSetReps: 0,
      lastSetElapsedSec: 0,
      startedAt: Date.now(),
      sessionReview: null,
    })),
  clear: () =>
    set({
      startedAt: Date.now(),
      errors: [],
      lastSetReps: 0,
      lastSetElapsedSec: 0,
      currentSetNumber: 1,
      workoutSetSnapshots: [],
      sessionReview: null,
    }),
}));
