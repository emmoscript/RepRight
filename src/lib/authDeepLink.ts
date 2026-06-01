import * as QueryParams from 'expo-auth-session/build/QueryParams';

import { isAllowedAuthRedirectUri } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabaseClient';

function authParamsFromUrl(url: string): Record<string, string> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }
  return params;
}

export function isAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('access_token=') || lower.includes('refresh_token=') || lower.includes('code=')) {
    return true;
  }
  return lower.includes('auth/callback');
}

/**
 * Exchange tokens/code from the email verification deep link into a persisted Supabase session.
 * Returns null when the URL is not an auth callback.
 */
export async function createSessionFromAuthUrl(url: string) {
  if (!isAuthCallbackUrl(url)) {
    return null;
  }

  const base = url.split('#')[0]?.split('?')[0] ?? url;
  if (base.includes('auth/callback') && !isAllowedAuthRedirectUri(url)) {
    throw new Error('Invalid authentication redirect.');
  }

  const params = authParamsFromUrl(url);

  if (params.error_description) {
    throw new Error(params.error_description);
  }
  if (params.error) {
    throw new Error(params.error);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}
