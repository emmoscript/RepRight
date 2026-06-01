import { getAuthRedirectUri } from '@/lib/authRedirect';
import { createSessionFromAuthUrl } from '@/lib/authDeepLink';
import { isEmailConfirmed, supabase } from '@/lib/supabaseClient';
import { resetToMainTabs, resetToWelcome } from '@/navigation/navigationRef';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import {
  EmailNotConfirmedError,
  isSupabaseEmailNotConfirmedMessage,
} from '@/utils/authErrors';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { create } from 'zustand';

type User = {
  id: string;
  email: string | null;
  auth_provider: 'email' | 'apple' | 'google';
};

type AuthState = {
  isLoggedIn: boolean;
  isGuest: boolean;
  user: User | null;
  participantId: string;
  isLoading: boolean;
  /** True after the first restoreSession() completes — gate app shell until then. */
  authReady: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;

  signUp: (email: string, password: string, displayName?: string) => Promise<{ needsEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterAsGuest: () => void;
  restoreSession: () => Promise<void>;
  initAuthListener: () => void;
  resendConfirmationEmail: (email: string) => Promise<void>;
  handleAuthCallbackUrl: (url: string) => Promise<boolean>;
  refreshVerificationStatus: () => Promise<boolean>;
  clearError: () => void;
};

const randomParticipant = () => `P${String(Math.floor(Math.random() * 900) + 100)}`;

const syncDisplayNameFromAuthUser = async (metadata: Record<string, unknown> | undefined) => {
  const raw = metadata?.full_name;
  if (typeof raw === 'string' && raw.trim()) {
    await useUserPreferencesStore.getState().setDisplayName(raw.trim());
  }
};

function mapUser(authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    auth_provider: 'email',
  };
}

function applyVerifiedSession(set: (partial: Partial<AuthState>) => void, session: Session) {
  const authUser = session.user;
  if (!isEmailConfirmed(authUser)) {
    return false;
  }
  set({
    isLoggedIn: true,
    isGuest: false,
    user: mapUser(authUser),
    pendingVerificationEmail: null,
    error: null,
  });
  return true;
}

let authListenerStarted = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  isGuest: false,
  user: null,
  participantId: randomParticipant(),
  isLoading: false,
  authReady: false,
  error: null,
  pendingVerificationEmail: null,

  clearError: () => set({ error: null }),

  enterAsGuest: () => {
    set({
      isGuest: true,
      isLoggedIn: false,
      user: null,
      pendingVerificationEmail: null,
      participantId: randomParticipant(),
      error: null,
    });
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const trimmedName = displayName?.trim() ?? '';
      const redirectTo = getAuthRedirectUri();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: trimmedName ? { full_name: trimmedName } : undefined,
        },
      });

      if (error) throw error;

      if (trimmedName) {
        await useUserPreferencesStore.getState().setDisplayName(trimmedName);
      }

      if (data.session && data.user && isEmailConfirmed(data.user)) {
        await syncDisplayNameFromAuthUser(data.user.user_metadata);
        applyVerifiedSession(set, data.session);
        return { needsEmailVerification: false };
      }

      // Do not keep a partial session — access only after the email link is opened.
      await supabase.auth.signOut();
      set({
        isLoggedIn: false,
        isGuest: false,
        user: null,
        pendingVerificationEmail: email,
        error: null,
      });
      return { needsEmailVerification: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ error: message, isLoading: false });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (isSupabaseEmailNotConfirmedMessage(error.message)) {
          set({ pendingVerificationEmail: email, isLoading: false });
          throw new EmailNotConfirmedError();
        }
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('Sign in failed');
      }

      if (!isEmailConfirmed(data.user)) {
        await supabase.auth.signOut();
        set({ pendingVerificationEmail: email, isLoading: false });
        throw new EmailNotConfirmedError();
      }

      await syncDisplayNameFromAuthUser(data.user.user_metadata);
      applyVerifiedSession(set, data.session);
      resetToMainTabs();
    } catch (err) {
      if (!(err instanceof EmailNotConfirmedError)) {
        const message = err instanceof Error ? err.message : 'Sign in failed';
        set({ error: message, isLoading: false });
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  resendConfirmationEmail: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getAuthRedirectUri() },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resend email';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  handleAuthCallbackUrl: async (url) => {
    set({ isLoading: true, error: null });
    try {
      const session = await createSessionFromAuthUrl(url);
      if (!session?.user) {
        return false;
      }

      if (!isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        set({
          isLoggedIn: false,
          user: null,
          pendingVerificationEmail: session.user.email ?? get().pendingVerificationEmail,
        });
        return false;
      }

      await syncDisplayNameFromAuthUser(session.user.user_metadata);
      const ok = applyVerifiedSession(set, session);
      if (ok) resetToMainTabs();
      return ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email verification failed';
      set({ error: message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshVerificationStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      if (!session?.user) {
        return false;
      }
      if (!isEmailConfirmed(session.user)) {
        return false;
      }
      await syncDisplayNameFromAuthUser(session.user.user_metadata);
      return applyVerifiedSession(set, session);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify status';
      set({ error: message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({
        isLoggedIn: false,
        isGuest: false,
        user: null,
        pendingVerificationEmail: null,
        participantId: randomParticipant(),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const session = data.session;
      if (!session?.user) {
        set({ isLoggedIn: false, isGuest: false, user: null });
        return;
      }

      if (!isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        set({
          isLoggedIn: false,
          isGuest: false,
          user: null,
          pendingVerificationEmail: session.user.email ?? null,
        });
        return;
      }

      await syncDisplayNameFromAuthUser(session.user.user_metadata);
      applyVerifiedSession(set, session);
    } catch {
      set({ isLoggedIn: false, isGuest: false, user: null });
    } finally {
      set({ isLoading: false, authReady: true });
    }
  },

  initAuthListener: () => {
    if (authListenerStarted) return;
    authListenerStarted = true;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({
          isLoggedIn: false,
          isGuest: false,
          user: null,
          pendingVerificationEmail: null,
        });
        resetToWelcome();
        return;
      }

      if (
        session?.user &&
        isEmailConfirmed(session.user) &&
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
      ) {
        void syncDisplayNameFromAuthUser(session.user.user_metadata);
        applyVerifiedSession(set, session);
        if (event === 'SIGNED_IN') {
          resetToMainTabs();
        }
      }
    });
  },
}));

export const selectIsLoggedIn = (state: AuthState) => state.isLoggedIn;
export const selectUser = (state: AuthState) => state.user;
export const selectError = (state: AuthState) => state.error;
