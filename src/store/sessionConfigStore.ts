import { create } from "zustand";

type SessionConfigState = {
  exercise: "conventional_deadlift" | "other";
  setCount: number;
  weight: number | null;
  patch: (
    c: Partial<Pick<SessionConfigState, "exercise" | "setCount" | "weight">>,
  ) => void;
  reset: () => void;
};

export const useSessionConfigStore = create<SessionConfigState>((set) => ({
  exercise: "conventional_deadlift",
  setCount: 3,
  weight: null,
  patch: (c) => set((s) => ({ ...s, ...c })),
  reset: () =>
    set({ exercise: "conventional_deadlift", setCount: 3, weight: null }),
}));
