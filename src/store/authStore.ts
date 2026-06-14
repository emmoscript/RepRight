import { signInWithApple } from '@/lib/appleSignIn';
import { displayNameFromMetadata, pullProfileFromSupabase } from '@/lib/profileSync';
import { resolveAnonymousGuestLabel } from '@/lib/anonymousGuest';
import { getAuthRedirectUri } from '@/lib/authRedirect';
import { createSessionFromAuthUrl } from '@/lib/authDeepLink';
import { signInWithOAuthProvider } from '@/lib/oauthSignIn';
import { isEmailConfirmed, isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { clearAllSessionsForOwner } from '@/modules/session';
import { resetToMainTabs, resetToWelcome } from '@/navigation/navigationRef';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import {
  EmailNotConfirmedError,
  formatAuthErrorMessage,
  isOAuthCancelledError,
  isSupabaseEmailNotConfirmedMessage,
  normalizeAuthEmail,
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
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  enterAsGuest: () => Promise<void>;
  restoreSession: () => Promise<void>;
  initAuthListener: () => void;
  resendConfirmationEmail: (email: string) => Promise<void>;
  handleAuthCallbackUrl: (url: string) => Promise<boolean>;
  refreshVerificationStatus: () => Promise<boolean>;
  clearError: () => void;
};

const randomParticipant = () => `P${String(Math.floor(Math.random() * 900) + 100)}`;

const syncDisplayNameFromAuthUser = async (metadata: Record<string, unknown> | undefined) => {
  const name = displayNameFromMetadata(metadata);
  if (name) {
    await useUserPreferencesStore.getState().setDisplayName(name);
  }
};

function authProviderFromUser(authUser: SupabaseUser): User['auth_provider'] {
  const provider = authUser.app_metadata?.provider;
  if (provider === 'google') return 'google';
  if (provider === 'apple') return 'apple';
  return 'email';
}

function mapUser(authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    auth_provider: authProviderFromUser(authUser),
  };
}

function researchIdentityFromUser(authUser: SupabaseUser): string {
  return authUser.email?.trim() || authUser.id;
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
    participantId: researchIdentityFromUser(authUser),
    pendingVerificationEmail: null,
    error: null,
  });
  void pullProfileFromSupabase(authUser.id);
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

  enterAsGuest: async () => {
    set({ isLoading: true, error: null });
    try {
      const label = await resolveAnonymousGuestLabel();
      set({
        isGuest: true,
        isLoggedIn: false,
        user: null,
        pendingVerificationEmail: null,
        participantId: label,
        error: null,
        isLoading: false,
      });
    } catch {
      set({
        isGuest: true,
        isLoggedIn: false,
        user: null,
        pendingVerificationEmail: null,
        participantId: 'Invitado anónimo',
        error: null,
        isLoading: false,
      });
    }
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    const normalizedEmail = normalizeAuthEmail(email);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }
      const trimmedName = displayName?.trim() ?? '';
      const redirectTo = getAuthRedirectUri();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: trimmedName ? { full_name: trimmedName } : undefined,
        },
      });

      if (error) {
        if (__DEV__) {
          console.error('[auth] signUp failed', {
            message: error.message,
            status: error.status,
            code: error.code,
          });
        }
        throw error;
      }

      if (trimmedName) {
        await useUserPreferencesStore.getState().setDisplayName(trimmedName);
      }

      if (data.session && data.user && isEmailConfirmed(data.user)) {
        await syncDisplayNameFromAuthUser(data.user.user_metadata);
        applyVerifiedSession(set, data.session);
        return { needsEmailVerification: false };
      }

      // Keep an unconfirmed session when Supabase returns one — lets "I've verified" refresh tokens.
      if (data.session && data.user) {
        set({
          isLoggedIn: false,
          isGuest: false,
          user: null,
          pendingVerificationEmail: normalizedEmail,
          error: null,
        });
        return { needsEmailVerification: true };
      }

      await supabase.auth.signOut();
      set({
        isLoggedIn: false,
        isGuest: false,
        user: null,
        pendingVerificationEmail: normalizedEmail,
        error: null,
      });
      return { needsEmailVerification: true };
    } catch (err) {
      if (__DEV__) {
        console.error('[auth] signUp exception', err);
      }
      const message = formatAuthErrorMessage(err);
      set({ error: message, isLoading: false });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const normalizedEmail = normalizeAuthEmail(email);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (error) {
        if (__DEV__) {
          console.error('[auth] signIn failed', {
            message: error.message,
            status: error.status,
            code: error.code,
          });
        }
        if (isSupabaseEmailNotConfirmedMessage(error.message)) {
          set({ pendingVerificationEmail: normalizedEmail, isLoading: false });
          throw new EmailNotConfirmedError();
        }
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('Sign in failed');
      }

      if (!isEmailConfirmed(data.user)) {
        await supabase.auth.signOut();
        set({ pendingVerificationEmail: normalizedEmail, isLoading: false });
        throw new EmailNotConfirmedError();
      }

      await syncDisplayNameFromAuthUser(data.user.user_metadata);
      applyVerifiedSession(set, data.session);
      resetToMainTabs();
    } catch (err) {
      if (!(err instanceof EmailNotConfirmedError)) {
        set({ error: formatAuthErrorMessage(err), isLoading: false });
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }

      const session = await signInWithOAuthProvider('google');
      await syncDisplayNameFromAuthUser(session.user.user_metadata);
      const ok = applyVerifiedSession(set, session);
      if (ok) resetToMainTabs();
    } catch (err) {
      if (isOAuthCancelledError(err)) return;
      if (__DEV__) {
        console.error('[auth] Google sign-in failed', err);
      }
      set({ error: formatAuthErrorMessage(err), isLoading: false });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithApple: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }

      const session = await signInWithApple();
      await syncDisplayNameFromAuthUser(session.user.user_metadata);
      const ok = applyVerifiedSession(set, session);
      if (ok) resetToMainTabs();
    } catch (err) {
      if (isOAuthCancelledError(err)) return;
      if (__DEV__) {
        console.error('[auth] Apple sign-in failed', err);
      }
      set({ error: formatAuthErrorMessage(err), isLoading: false });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  requestPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    const normalizedEmail = normalizeAuthEmail(email);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUri(),
      });
      if (error) {
        if (__DEV__) {
          console.error('[auth] password reset failed', {
            message: error.message,
            status: error.status,
            code: error.code,
          });
        }
        throw error;
      }
    } catch (err) {
      set({ error: formatAuthErrorMessage(err), isLoading: false });
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
      if (isOAuthCancelledError(err)) return false;
      set({ error: formatAuthErrorMessage(err) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshVerificationStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let session = sessionData.session;
      if (!session) {
        if (__DEV__) console.log('[auth] refreshVerificationStatus: no local session — sign in required');
        return false;
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        session = refreshed.session;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const user = userData.user ?? session.user;
      if (!user || !isEmailConfirmed(user)) {
        if (__DEV__) console.log('[auth] refreshVerificationStatus: email not confirmed yet');
        return false;
      }

      await syncDisplayNameFromAuthUser(user.user_metadata);
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

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    const userId = get().user?.id;
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(
          'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart Metro.',
        );
      }
      if (!userId) {
        throw new Error('No account to delete');
      }

      const ownerKey = `user:${userId}`;
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;

      await clearAllSessionsForOwner(ownerKey);
      await supabase.auth.signOut();

      set({
        isLoggedIn: false,
        isGuest: false,
        user: null,
        pendingVerificationEmail: null,
        participantId: randomParticipant(),
        error: null,
      });
      resetToWelcome();
    } catch (err) {
      const message = formatAuthErrorMessage(err);
      set({ error: message });
      throw err;
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
