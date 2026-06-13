import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { randomUUID } from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabaseClient';
import { OAuthCancelledError } from '@/utils/authErrors';

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

function fullNameFromAppleCredential(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) return null;
  const given = fullName.givenName?.trim() ?? '';
  const family = fullName.familyName?.trim() ?? '';
  const combined = [given, family].filter(Boolean).join(' ');
  return combined.length > 0 ? combined : null;
}

/** Native Sign in with Apple → Supabase session via identity token. iOS only. */
export async function signInWithAppleNative(): Promise<Session> {
  const available = await isAppleSignInAvailable();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const rawNonce = randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('Apple Sign In did not return an identity token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;
    if (!data.session?.user) {
      throw new Error('Could not complete Apple sign in.');
    }

    const fullName = fullNameFromAppleCredential(credential.fullName);
    if (fullName) {
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          display_name: fullName,
        },
      });
    }

    const { data: refreshed } = await supabase.auth.getSession();
    return refreshed.session ?? data.session;
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new OAuthCancelledError();
    }
    throw err;
  }
}
