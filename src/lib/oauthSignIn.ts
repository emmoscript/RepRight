import * as WebBrowser from 'expo-web-browser';
import type { Provider, Session } from '@supabase/supabase-js';

import { createSessionFromAuthUrl } from '@/lib/authDeepLink';
import { getAuthRedirectUri } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabaseClient';
import { OAuthCancelledError } from '@/utils/authErrors';

WebBrowser.maybeCompleteAuthSession();

/** Opens the system browser for Supabase OAuth and exchanges the callback URL for a session. */
export async function signInWithOAuthProvider(provider: Provider): Promise<Session> {
  const redirectTo = getAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      ...(provider === 'google'
        ? {
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          }
        : {}),
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Could not start sign in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new OAuthCancelledError();
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('Sign in was not completed.');
  }

  const session = await createSessionFromAuthUrl(result.url);
  if (!session?.user) {
    throw new Error('Could not complete sign in.');
  }

  return session;
}
