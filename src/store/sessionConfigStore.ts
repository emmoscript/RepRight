import { create } from 'zustand';

import type { WeightUnit } from '@/utils/weightUnits';
import {
  buildSetPlans,
  clampSetReps,
  patchSetPlanRow,
  type WorkoutSetPlanRow,
} from '@/utils/setPlan';

export type { WorkoutSetPlanRow };

type SessionConfigState = {
  exercise: 'conventional_deadlift' | 'other';
  setCount: number;
  /** Default reps when {@link customSetPlan} is false. */
  repsPerSet: number;
  customSetPlan: boolean;
  /** Per-set targets when {@link customSetPlan} is true (length = {@link setCount}). */
  setPlans: WorkoutSetPlanRow[];
  weightUnit: WeightUnit;
  weightAmount: number;
  patch: (
    c: Partial<
      Pick<
        SessionConfigState,
        'exercise' | 'setCount' | 'repsPerSet' | 'customSetPlan' | 'setPlans' | 'weightUnit' | 'weightAmount'
      >
    >,
  ) => void;
  setSetCount: (count: number) => void;
  setCustomSetPlan: (custom: boolean) => void;
  updateSetPlanRow: (index0: number, row: Partial<WorkoutSetPlanRow>) => void;
  /** Overrides for the upcoming set (Session Complete → next LiveSession). */
  applyNextSetTarget: (setNumber1Based: number, weightAmount: number, reps: number) => void;
};

const INITIAL_SET_COUNT = 3;
const INITIAL_REPS = 5;
const INITIAL_WEIGHT = 80;

export const useSessionConfigStore = create<SessionConfigState>((set) => ({
  exercise: 'conventional_deadlift',
  setCount: INITIAL_SET_COUNT,
  repsPerSet: INITIAL_REPS,
  customSetPlan: false,
  setPlans: buildSetPlans(INITIAL_SET_COUNT, INITIAL_REPS, INITIAL_WEIGHT),
  weightUnit: 'kg',
  weightAmount: INITIAL_WEIGHT,
  patch: (c) => set((s) => ({ ...s, ...c })),
  setSetCount: (count) =>
    set((s) => ({
      setCount: count,
      setPlans: buildSetPlans(count, s.repsPerSet, s.weightAmount, s.setPlans),
    })),
  setCustomSetPlan: (customSetPlan) =>
    set((s) => ({
      customSetPlan,
      setPlans: customSetPlan
        ? buildSetPlans(s.setCount, s.repsPerSet, s.weightAmount, s.setPlans)
        : s.setPlans,
    })),
  updateSetPlanRow: (index0, row) =>
    set((s) => ({
      setPlans: patchSetPlanRow(s.setPlans, index0, row),
    })),
  applyNextSetTarget: (setNumber1Based, weightAmount, reps) =>
    set((s) => {
      const repsClamped = clampSetReps(reps);
      if (s.customSetPlan) {
        return {
          weightAmount,
          setPlans: patchSetPlanRow(s.setPlans, setNumber1Based - 1, {
            weightAmount,
            reps: repsClamped,
          }),
        };
      }
      return { weightAmount, repsPerSet: repsClamped };
    }),
}));
