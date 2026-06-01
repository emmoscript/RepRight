import * as Linking from 'expo-linking';

/** Path segment matched by Supabase `emailRedirectTo` (register in Supabase Auth → URL Configuration). */
export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Deep link that Supabase redirects to after the user taps the email verification link. */
export function getAuthRedirectUri(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/**
 * Allowed redirect prefixes for this app (must also be listed in Supabase Dashboard → Auth → Redirect URLs):
 * - repright://auth/callback
 * - com.unibe.repright://auth/callback
 * - exp+repright://auth/callback (Expo Dev Client)
 */
export const AUTH_REDIRECT_ALLOWLIST = [
  Linking.createURL(AUTH_CALLBACK_PATH),
  'repright://auth/callback',
  'com.unibe.repright://auth/callback',
] as const;

export function isAllowedAuthRedirectUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return AUTH_REDIRECT_ALLOWLIST.some((allowed) => lower.startsWith(allowed.toLowerCase()));
}
