import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (__DEV__) {
  if (!supabaseUrl) console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL is not set');
  if (!supabaseAnonKey) console.warn('[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
}

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
    flowType: 'pkce',
  },
});

export function isEmailConfirmed(user: SupabaseUser | null | undefined): boolean {
  return !!user?.email_confirmed_at;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
