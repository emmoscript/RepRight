import "@/i18n";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from "@expo-google-fonts/inter";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Font from "expo-font";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "@/navigation/RootNavigator";
import { useAuthStore } from "@/store/authStore";
import {
    resolveSubscriptionOwnerKey,
    useSubscriptionStore,
} from "@/store/subscriptionStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";

void SplashScreen.preventAutoHideAsync();

const APP_FONT_MAP = {
  ...Ionicons.font,
  ...MaterialIcons.font,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  SpaceGrotesk_700Bold,
} as const satisfies Record<string, Font.FontSource>;

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const authReady = useAuthStore((s) => s.authReady);
  const prefsReady = useUserPreferencesStore((s) => s.hydrated);
  const subReady = useSubscriptionStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isGuest = useAuthStore((s) => s.isGuest);
  const participantId = useAuthStore((s) => s.participantId);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    useAuthStore.getState().initAuthListener();
    void useUserPreferencesStore.getState().hydrate();
    void useAuthStore.getState().restoreSession();
    if (__DEV__) {
      void import("@/lib/supabaseClient").then(({ pingSupabase }) => {
        void pingSupabase().then((r) => {
          console.log(`[supabase] ping ${r.ok ? "OK" : "FAILED"}: ${r.detail}`);
          if (!r.ok && r.detail.includes("Network request failed")) {
            console.warn(
              "[supabase] Device cannot reach your project URL. In Supabase Dashboard → Settings → API, copy Project URL again. Open that URL in the phone browser — if it fails, the project is paused or DNS is broken (not an app bug).",
            );
          }
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!authReady || !prefsReady) return;
    const ownerKey = resolveSubscriptionOwnerKey({
      isLoggedIn,
      isGuest,
      userId,
      participantId,
    });
    void useSubscriptionStore.getState().hydrate(ownerKey);
  }, [authReady, prefsReady, isLoggedIn, isGuest, participantId, userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Font.loadAsync(APP_FONT_MAP);
      } catch (e) {
        if (__DEV__) {
          console.warn(
            "Font.loadAsync failed; icon fonts may flash until loaded:",
            e,
          );
        }
      } finally {
        if (!cancelled) setFontsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady || !authReady || !prefsReady || !subReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
