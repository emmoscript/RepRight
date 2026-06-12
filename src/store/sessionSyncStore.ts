import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { create } from "zustand";

import type {
  BiomechanicalErrorInput,
  SaveSessionWithErrorsParams,
  SessionSyncExtras,
} from "@/lib/supabaseTypes";
import * as Crypto from "expo-crypto";

export type { BiomechanicalErrorInput };

type LocalSession = {
  id: string;
  exercise: string;
  set_count: number;
  started_at: number;
  weight: number | null;
  weight_unit: SessionSyncExtras["weightUnit"];
  total_reps: number | null;
  form_score: number | null;
  completion_pct: number | null;
  avg_score: number | null;
  errors: BiomechanicalErrorInput[];
  status: "local" | "syncing" | "synced" | "failed";
};

type SessionSyncState = {
  sessions: Map<string, LocalSession>;
  isOnline: boolean;

  startSession: (
    exercise: string,
    weight?: number | null,
    startedAtMs?: number,
  ) => Promise<string>;
  addError: (sessionId: string, error: BiomechanicalErrorInput) => Promise<void>;
  addErrors: (sessionId: string, errors: BiomechanicalErrorInput[]) => Promise<void>;
  completeSession: (
    sessionId: string,
    setCount: number,
    weight?: number | null,
    extras?: SessionSyncExtras,
  ) => Promise<string | null>;
  syncSessions: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
};

function validateWeight(weight: number | null | undefined): boolean {
  if (weight === undefined || weight === null) return true;
  return Number.isFinite(weight) && weight > 0;
}

export const useSessionSyncStore = create<SessionSyncState>((set, get) => ({
  sessions: new Map(),
  isOnline: true,

  startSession: async (exercise, weight, startedAtMs) => {
    const sessionId = Crypto.randomUUID();
    const session: LocalSession = {
      id: sessionId,
      exercise,
      set_count: 1,
      started_at: startedAtMs ?? Date.now(),
      weight: weight ?? null,
      weight_unit: "lb",
      total_reps: null,
      form_score: null,
      completion_pct: null,
      avg_score: null,
      errors: [],
      status: "local",
    };

    set((state) => ({
      sessions: new Map(state.sessions).set(sessionId, session),
    }));

    return sessionId;
  },

  addError: async (sessionId, error) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(sessionId);
      if (!session) return { sessions };
      const dup = session.errors.some((e) => e.error_type === error.error_type);
      if (!dup) session.errors.push(error);
      return { sessions };
    });
  },

  addErrors: async (sessionId, errors) => {
    for (const err of errors) {
      await get().addError(sessionId, err);
    }
  },

  completeSession: async (sessionId, setCount, weight, extras) => {
    if (!validateWeight(weight)) {
      console.error("❌ Invalid weight for sync");
      return null;
    }

    const state = get();
    const session = state.sessions.get(sessionId);
    if (!session) {
      console.error("ERROR: Session not found in sync store");
      return null;
    }

    session.set_count = setCount;
    if (weight !== undefined) session.weight = weight;
    if (extras) {
      session.weight_unit = extras.weightUnit;
      session.total_reps = extras.totalReps;
      session.form_score = extras.formScore;
      session.completion_pct = extras.completionPct;
      session.avg_score = extras.avgScore;
      if (extras.startedAtMs != null) session.started_at = extras.startedAtMs;
    }
    session.status = "local";

    if (state.isOnline) {
      await get().syncSessions();
    }

    return sessionId;
  },

  syncSessions: async () => {
    const authState = useAuthStore.getState();
    if (!authState.isLoggedIn || !authState.user) {
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        await authState.restoreSession();
      }
    } catch {
      // continue — RPC will fail with Not authenticated if still broken
    }

    const state = get();
    const sessionsToSync = Array.from(state.sessions.values()).filter(
      (s) => s.status === "local" || s.status === "failed",
    );

    if (sessionsToSync.length === 0) return;

    for (const session of sessionsToSync) {
      try {
        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "syncing";
          return { sessions };
        });

        const rpcParams: SaveSessionWithErrorsParams = {
          p_exercise: session.exercise,
          p_set_count: session.set_count,
          p_started_at: new Date(session.started_at).toISOString(),
          p_weight: session.weight ?? null,
          p_weight_unit: session.weight_unit,
          p_total_reps: session.total_reps,
          p_form_score: session.form_score,
          p_completion_pct: session.completion_pct,
          p_avg_score: session.avg_score,
          p_errors: session.errors,
        };

        const { error } = await supabase.rpc("save_session_with_errors", rpcParams);

        if (error) throw error;

        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "synced";
          return { sessions };
        });
      } catch (err) {
        if (__DEV__) {
          console.error(`[sessionSync] failed ${session.id}:`, err);
        }
        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "failed";
          return { sessions };
        });
      }
    }
  },

  setOnlineStatus: (online) => {
    set({ isOnline: online });
    if (online) void get().syncSessions();
  },
}));
