import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

console.log("=== SUPABASE CLIENT INITIALIZATION ===");
console.log("Supabase URL configured:", !!supabaseUrl);
console.log("Supabase Anon Key configured:", !!supabaseAnonKey);
if (!supabaseUrl) console.error("ERROR: EXPO_PUBLIC_SUPABASE_URL is not set!");
if (!supabaseAnonKey)
  console.error("ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY is not set!");

// Use AsyncStorage for development (no native compilation needed)
// For production with secure storage, rebuild dev client or use EAS build
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
      // Error al guardar
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Error al eliminar
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageWrapper,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
