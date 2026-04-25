import { create } from 'zustand';

type SessionConfigState = {
  exercise: 'conventional_deadlift' | 'other';
  setCount: number;
  patch: (c: Partial<Pick<SessionConfigState, 'exercise' | 'setCount'>>) => void;
};

export const useSessionConfigStore = create<SessionConfigState>((set) => ({
  exercise: 'conventional_deadlift',
  setCount: 3,
  patch: (c) => set((s) => ({ ...s, ...c })),
}));
