import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import * as Crypto from "expo-crypto";

export type BiomechanicalErrorInput = {
  error_type: string;
  timestamp_ms: number;
  confidence: number;
  severity: "low" | "medium" | "high";
  metadata?: Record<string, any>;
};

type LocalSession = {
  id: string; // UUID local
  exercise: string;
  set_count: number;
  started_at: number; // timestamp ms
  weight: number | null; // weight in kg or lb
  errors: BiomechanicalErrorInput[];
  status: "local" | "syncing" | "synced" | "failed";
};

type SessionSyncState = {
  sessions: Map<string, LocalSession>;
  isOnline: boolean;

  startSession: (exercise: string, weight?: number | null) => Promise<string>;
  addError: (
    sessionId: string,
    error: BiomechanicalErrorInput,
  ) => Promise<void>;
  completeSession: (
    sessionId: string,
    setCount: number,
    weight?: number | null,
  ) => Promise<string | null>;
  syncSessions: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
};

export const useSessionSyncStore = create<SessionSyncState>((set, get) => ({
  sessions: new Map(),
  isOnline: true,

  startSession: async (exercise: string, weight?: number | null) => {
    const sessionId = Crypto.randomUUID();
    const session: LocalSession = {
      id: sessionId,
      exercise,
      set_count: 1,
      started_at: Date.now(),
      weight: weight ?? null,
      errors: [],
      status: "local",
    };

    set((state) => ({
      sessions: new Map(state.sessions).set(sessionId, session),
    }));

    return sessionId;
  },

  addError: async (sessionId: string, error: BiomechanicalErrorInput) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(sessionId);
      if (session) {
        session.errors.push(error);
      }
      return { sessions };
    });
  },

  completeSession: async (
    sessionId: string,
    setCount: number,
    weight?: number | null,
  ) => {
    console.log("\n=== SYNC STORE: COMPLETE SESSION ===");
    console.log("Session ID:", sessionId);
    console.log("Set count:", setCount);
    console.log("Weight:", weight);

    const state = get();
    const session = state.sessions.get(sessionId);

    if (!session) {
      console.error("ERROR: Session not found in store");
      return null;
    }

    console.log("Session found, updating:", {
      exercise: session.exercise,
      errors_count: session.errors.length,
    });

    session.set_count = setCount;
    if (weight !== undefined) {
      session.weight = weight;
    }
    session.status = "local";

    console.log("Session updated to local status");

    // Intentar sincronizar inmediatamente si está online
    if (state.isOnline) {
      console.log("Online status: true, initiating sync");
      await get().syncSessions();
    } else {
      console.log("Online status: false, sync will happen when online");
    }

    return sessionId;
  },

  syncSessions: async () => {
    console.log("\n=== SYNC STORE: SYNC SESSIONS ===");

    // Check authentication status
    const authState = useAuthStore.getState();
    console.log("Auth state:", {
      isLoggedIn: authState.isLoggedIn,
      user: authState.user,
      userId: authState.user?.id,
    });

    if (!authState.isLoggedIn || !authState.user) {
      console.error("ERROR: User is not authenticated. Cannot sync sessions.");
      return;
    }

    // Try to restore session from Supabase if needed
    try {
      console.log("Checking Supabase session...");
      const { data, error } = await supabase.auth.getSession();
      console.log("Supabase session check:", {
        hasSession: !!data.session,
        sessionUser: data.session?.user?.id,
        error: error?.message,
      });

      if (error) {
        console.error("Error checking Supabase session:", error);
      }

      if (!data.session) {
        console.error(
          "ERROR: No Supabase session found. Attempting to restore...",
        );
        await authState.restoreSession();
      }
    } catch (err) {
      console.error("Error during session check:", err);
    }

    const state = get();
    const sessionsToSync = Array.from(state.sessions.values()).filter(
      (s) => s.status === "local" || s.status === "failed",
    );

    console.log("Sessions to sync:", sessionsToSync.length);
    if (sessionsToSync.length === 0) {
      console.log("No sessions to sync");
      return;
    }

    for (const session of sessionsToSync) {
      try {
        console.log("\n--- Syncing session:", session.id);
        console.log("Session data:", {
          exercise: session.exercise,
          set_count: session.set_count,
          weight: session.weight,
          errors_count: session.errors.length,
          started_at: new Date(session.started_at).toISOString(),
        });

        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "syncing";
          return { sessions };
        });

        console.log("Calling Supabase RPC: save_session_with_errors");

        // Llamar RPC de Supabase
        const { data, error } = await supabase.rpc("save_session_with_errors", {
          p_exercise: session.exercise,
          p_set_count: session.set_count,
          p_started_at: new Date(session.started_at).toISOString(),
          p_weight: session.weight || null,
          p_errors: session.errors,
        });

        console.log("Supabase RPC response received");
        console.log("Response data:", data);
        console.log("Response error:", error);

        if (error) {
          console.error("RPC error returned:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          throw error;
        }

        console.log("Session synced successfully");

        // Marcar como sincronizado
        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "synced";
          return { sessions };
        });
      } catch (err) {
        console.error(`\n=== FAILED TO SYNC SESSION ${session.id} ===`);
        console.error(
          "Error message:",
          err instanceof Error ? err.message : String(err),
        );
        console.error(
          "Error type:",
          err instanceof Error ? err.constructor.name : typeof err,
        );

        // Enhanced error details for auth issues
        if (err && typeof err === "object") {
          const errObj = err as any;
          console.error("Error details:", {
            message: errObj.message,
            code: errObj.code,
            details: errObj.details,
            hint: errObj.hint,
            status: errObj.status,
          });
        }

        console.error("Full error:", err);

        // Check current auth state
        const authState = useAuthStore.getState();
        console.error("Current auth state:", {
          isLoggedIn: authState.isLoggedIn,
          userId: authState.user?.id,
        });

        set((state) => {
          const sessions = new Map(state.sessions);
          const s = sessions.get(session.id);
          if (s) s.status = "failed";
          return { sessions };
        });
      }
    }
  },

  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online });
    if (online) {
      // Intentar sincronizar cuando recupera conexión
      get().syncSessions();
    }
  },
}));
