import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingMainTabs = false;
let pendingWelcome = false;

export function resetToWelcome() {
  if (!navigationRef.isReady()) {
    pendingWelcome = true;
    pendingMainTabs = false;
    return false;
  }
  pendingWelcome = false;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'Welcome' }],
  });
  return true;
}

export function resetToMainTabs() {
  if (!navigationRef.isReady()) {
    pendingMainTabs = true;
    pendingWelcome = false;
    return false;
  }
  pendingMainTabs = false;
  pendingWelcome = false;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'MainTabs', params: { screen: 'HomeMain' } }],
  });
  return true;
}

/** Call from NavigationContainer onReady — flushes auth redirect if navigator mounted late. */
export function flushPendingAuthNavigation() {
  if (!navigationRef.isReady()) return;

  if (pendingWelcome) {
    resetToWelcome();
    return;
  }

  if (!pendingMainTabs && !useAuthStore.getState().isLoggedIn) return;

  const root = navigationRef.getRootState();
  const active = root?.routes[root.index ?? 0]?.name;

  if (active !== 'MainTabs') {
    resetToMainTabs();
  } else {
    pendingMainTabs = false;
  }
}

export function resetToEmailConfirm(email: string) {
  if (!navigationRef.isReady()) return false;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'EmailConfirm', params: { email } }],
  });
  return true;
}
