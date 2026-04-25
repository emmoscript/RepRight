import { create } from 'zustand';

import type { BiomechanicalError } from '@/modules/analyzer';

type SessionResultState = {
  startedAt: number;
  errors: BiomechanicalError[];
  setStartedAt: (t: number) => void;
  addErrors: (e: BiomechanicalError[]) => void;
  clear: () => void;
};

export const useSessionResultStore = create<SessionResultState>((set) => ({
  startedAt: Date.now(),
  errors: [],
  setStartedAt: (t) => set({ startedAt: t }),
  addErrors: (e) => set((s) => ({ errors: s.errors.concat(e) })),
  clear: () => set({ startedAt: Date.now(), errors: [] }),
}));
