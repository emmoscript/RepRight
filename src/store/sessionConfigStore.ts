import { create } from 'zustand';

import type { WeightUnit } from '@/utils/weightUnits';

type SessionConfigState = {
  exercise: 'conventional_deadlift' | 'other';
  setCount: number;
  /** kg vs lb — {@link weightAmount} is expressed in this unit. */
  weightUnit: WeightUnit;
  /** Working weight for the session (value in {@link weightUnit}). */
  weightAmount: number;
  patch: (
    c: Partial<Pick<SessionConfigState, 'exercise' | 'setCount' | 'weightUnit' | 'weightAmount'>>,
  ) => void;
};

export const useSessionConfigStore = create<SessionConfigState>((set) => ({
  exercise: 'conventional_deadlift',
  setCount: 3,
  weightUnit: 'kg',
  weightAmount: 80,
  patch: (c) => set((s) => ({ ...s, ...c })),
}));
