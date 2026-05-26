import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

console.log("=== SUPABASE CLIENT INITIALIZATION ===");
console.log("Supabase URL configured:", !!supabaseUrl);
console.log("Supabase Anon Key configured:", !!supabaseAnonKey);
if (!supabaseUrl) console.error("ERROR: EXPO_PUBLIC_SUPABASE_URL is not set!");
if (!supabaseAnonKey)
  console.error("ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY is not set!");

// Custom storage para tokens seguros
const ExpoSecureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Error al guardar
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Error al eliminar
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
