import { REPS_PER_SET_MAX, REPS_PER_SET_MIN } from '@/components/RepsSlider';

export type WorkoutSetPlanRow = {
  reps: number;
  weightAmount: number;
};

export function clampSetReps(n: number): number {
  return Math.min(REPS_PER_SET_MAX, Math.max(REPS_PER_SET_MIN, Math.round(n)));
}

export function defaultSetPlanRow(reps: number, weightAmount: number): WorkoutSetPlanRow {
  return { reps: clampSetReps(reps), weightAmount };
}

/** Resize / pad set plan rows when set count changes. New rows copy the last row or fallback. */
export function buildSetPlans(
  count: number,
  reps: number,
  weightAmount: number,
  existing?: WorkoutSetPlanRow[],
): WorkoutSetPlanRow[] {
  const fallback = defaultSetPlanRow(reps, weightAmount);
  const rows: WorkoutSetPlanRow[] = [];
  for (let i = 0; i < count; i++) {
    const prev = existing?.[i];
    if (prev) {
      rows.push({ ...prev });
    } else {
      const seed = rows[i - 1] ?? fallback;
      rows.push({ ...seed });
    }
  }
  return rows;
}

export type SetPlanConfigSlice = {
  customSetPlan: boolean;
  setCount: number;
  repsPerSet: number;
  weightAmount: number;
  setPlans: WorkoutSetPlanRow[];
};

/** 1-based set number → target reps + weight for live tracking / auto-finish. */
export function getSetTarget(config: SetPlanConfigSlice, setNumber1Based: number): WorkoutSetPlanRow {
  if (config.customSetPlan) {
    const row = config.setPlans[setNumber1Based - 1];
    if (row) return row;
  }
  return defaultSetPlanRow(config.repsPerSet, config.weightAmount);
}

export function patchSetPlanRow(
  plans: WorkoutSetPlanRow[],
  index0: number,
  patch: Partial<WorkoutSetPlanRow>,
): WorkoutSetPlanRow[] {
  return plans.map((row, i) => {
    if (i !== index0) return row;
    return {
      reps: patch.reps != null ? clampSetReps(patch.reps) : row.reps,
      weightAmount: patch.weightAmount ?? row.weightAmount,
    };
  });
}
