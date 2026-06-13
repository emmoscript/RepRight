import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

const GUEST_CLIENT_KEY = '@repright/guest_client_id';
const GUEST_LABEL_KEY = '@repright/guest_research_label';
const LOCAL_GUEST_SEQ_KEY = '@repright/local_guest_seq';

async function guestClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(GUEST_CLIENT_KEY);
  if (existing) return existing;
  const created = randomUUID();
  await AsyncStorage.setItem(GUEST_CLIENT_KEY, created);
  return created;
}

async function nextLocalGuestNumber(): Promise<number> {
  const raw = await AsyncStorage.getItem(LOCAL_GUEST_SEQ_KEY);
  const current = raw ? Number.parseInt(raw, 10) : 0;
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1;
  await AsyncStorage.setItem(LOCAL_GUEST_SEQ_KEY, String(next));
  return next;
}

function guestLabelFromNumber(n: number): string {
  return `Invitado anónimo ${n}`;
}

/** Stable research label for guest mode — synced to Supabase when available. */
export async function resolveAnonymousGuestLabel(): Promise<string> {
  const cached = await AsyncStorage.getItem(GUEST_LABEL_KEY);
  if (cached?.trim()) return cached.trim();

  const clientId = await guestClientId();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('get_or_create_anonymous_guest', {
        p_client_id: clientId,
      });
      const label = typeof data?.label === 'string' ? data.label.trim() : '';
      if (!error && label) {
        await AsyncStorage.setItem(GUEST_LABEL_KEY, label);
        return label;
      }
      if (__DEV__ && error) {
        console.warn('[anonymousGuest] RPC failed:', error.message);
      }
    } catch (err) {
      if (__DEV__) console.warn('[anonymousGuest] RPC error', err);
    }
  }

  const localNum = await nextLocalGuestNumber();
  const fallback = guestLabelFromNumber(localNum);
  await AsyncStorage.setItem(GUEST_LABEL_KEY, fallback);
  return fallback;
}
