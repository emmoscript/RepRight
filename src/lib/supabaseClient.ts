import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

function logSupabaseConfig() {
  if (!__DEV__) return;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env — restart Metro with -c after editing .env',
    );
    return;
  }
  try {
    const host = new URL(supabaseUrl).host;
    const keyKind = supabaseAnonKey.startsWith('eyJ')
      ? 'legacy-jwt'
      : supabaseAnonKey.startsWith('sb_publishable_')
        ? 'publishable'
        : 'unknown-format';
    console.log(`[supabase] configured host=${host} key=${keyKind}`);
    if (keyKind === 'unknown-format') {
      console.warn(
        '[supabase] Anon key format not recognized. In Supabase Dashboard → Project Settings → API, copy the anon/public key.',
      );
    }
  } catch {
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL is not a valid URL:', supabaseUrl);
  }
}

logSupabaseConfig();

const AsyncStorageWrapper = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore storage write failures
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore storage delete failures
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageWrapper,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Default flow avoids WebCrypto PKCE issues on some Android builds.
  },
});

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

/** Dev helper: verify the phone can reach Supabase (call once on app start). */
export async function pingSupabase(): Promise<{ ok: boolean; detail: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, detail: 'missing env vars' };
  }
  const url = `${supabaseUrl}/auth/v1/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { apikey: supabaseAnonKey },
    });
    const body = await res.text();
    if (res.ok) return { ok: true, detail: body || `HTTP ${res.status}` };
    return { ok: false, detail: `HTTP ${res.status}: ${body.slice(0, 120)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: msg };
  }
}

export function isEmailConfirmed(user: SupabaseUser | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  const provider = user.app_metadata?.provider;
  return provider === 'google' || provider === 'apple';
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
