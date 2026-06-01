import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { isAuthCallbackUrl } from '@/lib/authDeepLink';
import { resetToMainTabs } from '@/navigation/navigationRef';
import { useAuthStore } from '@/store/authStore';

async function processAuthUrl(url: string) {
  if (!isAuthCallbackUrl(url)) return;
  const ok = await useAuthStore.getState().handleAuthCallbackUrl(url);
  if (ok) {
    resetToMainTabs();
  }
}

/** Listens for Supabase email-verification deep links. Auth state sync lives in authStore.initAuthListener. */
export function useAuthDeepLink() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) void processAuthUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      void processAuthUrl(url);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      resetToMainTabs();
    }
  }, [isLoggedIn]);
}
