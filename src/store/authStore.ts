import { supabase } from "@/lib/supabaseClient";
import { syncSessionsFromSupabase } from "@/modules/session";
import { create } from "zustand";

type User = {
  id: string;
  email: string | null;
  auth_provider: "email" | "apple" | "google";
};

type AuthState = {
  // Datos
  isLoggedIn: boolean;
  user: User | null;
  participantId: string;
  isLoading: boolean;
  error: string | null;

  // Métodos
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

const randomParticipant = () =>
  `P${String(Math.floor(Math.random() * 900) + 100)}`;

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  participantId: randomParticipant(),
  isLoading: false,
  error: null,

  signUp: async (email, password) => {
    console.log("\n=== AUTH STORE SIGNUP STARTED ===");
    console.log("Email:", email);
    console.log("Password length:", password.length);
    set({ isLoading: true, error: null });
    try {
      console.log("Making Supabase signUp API call...");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log("Supabase response received");
      console.log("Response data:", data);
      console.log("Response error:", error);

      if (error) {
        console.error("Supabase returned error:", error.message);
        console.error("Error status:", error.status);
        console.error("Full error object:", JSON.stringify(error));
        throw error;
      }

      console.log("No error in response");

      if (data.user) {
        console.log("User object found:", {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        });
        set({
          isLoggedIn: true,
          user: {
            id: data.user.id,
            email: data.user.email ?? null,
            auth_provider: "email",
          },
          error: null,
        });
        console.log("Auth store updated successfully");

        // Sync existing sessions from Supabase to local storage
        console.log("Starting session sync from Supabase...");
        const state = { id: data.user.id };
        await syncSessionsFromSupabase(supabase, state.id);
      } else {
        console.log("WARNING: No user in response data");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      console.error("\n=== SIGNUP ERROR ===");
      console.error("Error message:", message);
      console.error(
        "Error type:",
        err instanceof Error ? err.constructor.name : typeof err,
      );
      console.error("Full error:", err);
      set({ error: message, isLoading: false });
      throw err;
    } finally {
      console.log("Setting isLoading to false");
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    console.log("\n=== AUTH STORE SIGNIN STARTED ===");
    console.log("Email:", email);
    console.log("Password length:", password.length);
    set({ isLoading: true, error: null });
    try {
      console.log("Making Supabase signIn API call...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Supabase response received");
      console.log("Response data:", data);
      console.log("Response error:", error);

      if (error) {
        console.error("Supabase returned error:", error.message);
        console.error("Error status:", error.status);
        console.error("Full error object:", JSON.stringify(error));
        throw error;
      }

      console.log("No error in response");

      if (data.user) {
        console.log("User object found:", {
          id: data.user.id,
          email: data.user.email,
        });
        set({
          isLoggedIn: true,
          user: {
            id: data.user.id,
            email: data.user.email ?? null,
            auth_provider: "email",
          },
          error: null,
        });
        console.log("Auth store updated successfully");

        // Sync existing sessions from Supabase to local storage
        console.log("Starting session sync from Supabase...");
        await syncSessionsFromSupabase(supabase, data.user.id);
      } else {
        console.log("WARNING: No user in response data");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      console.error("\n=== SIGNIN ERROR ===");
      console.error("Error message:", message);
      console.error(
        "Error type:",
        err instanceof Error ? err.constructor.name : typeof err,
      );
      console.error("Full error:", err);
      set({ error: message, isLoading: false });
      throw err;
    } finally {
      console.log("Setting isLoading to false");
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    console.log("\n=== AUTH STORE SIGNOUT STARTED ===");
    set({ isLoading: true });
    try {
      console.log("Making Supabase signOut API call...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut error:", error);
        throw error;
      }

      console.log("Sign out successful");
      set({
        isLoggedIn: false,
        user: null,
        participantId: randomParticipant(),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      console.error("\n=== SIGNOUT ERROR ===");
      console.error("Error message:", message);
      console.error("Full error:", err);
      set({ error: message });
    } finally {
      console.log("Setting isLoading to false");
      set({ isLoading: false });
    }
  },

  restoreSession: async () => {
    console.log("\n=== AUTH STORE RESTORE SESSION STARTED ===");
    set({ isLoading: true });
    try {
      console.log("Making Supabase getSession API call...");
      const { data, error } = await supabase.auth.getSession();

      console.log("Supabase response received");
      console.log("Response error:", error);
      console.log("Session data:", data);

      if (error) {
        console.error("Supabase getSession error:", error);
        throw error;
      }

      if (data.session?.user) {
        const authUser = data.session.user;
        console.log("Session found for user:", authUser.id);
        set({
          isLoggedIn: true,
          user: {
            id: authUser.id,
            email: authUser.email ?? null,
            auth_provider: "email",
          },
        });

        // Sync existing sessions from Supabase to local storage
        console.log("Starting session sync from Supabase...");
        await syncSessionsFromSupabase(supabase, authUser.id);
      } else {
        console.log("No session found, user is not logged in");
        set({ isLoggedIn: false, user: null });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore session";
      console.error("\n=== RESTORE SESSION ERROR ===");
      console.error("Error message:", message);
      console.error("Full error:", err);
      set({ isLoggedIn: false, user: null });
    } finally {
      console.log("Setting isLoading to false");
      set({ isLoading: false });
    }
  },
}));

// Selectores para facilitar acceso
export const selectIsLoggedIn = (state: AuthState) => state.isLoggedIn;
export const selectUser = (state: AuthState) => state.user;
export const selectError = (state: AuthState) => state.error;
