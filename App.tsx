import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from "@expo-google-fonts/inter";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import NetInfo from "@react-native-community/netinfo";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "@/navigation/RootNavigator";
import { useAuthStore } from "@/store/authStore";
import { useSessionSyncStore } from "@/store/sessionSyncStore";

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
  });

  const restoreSession = useAuthStore((s) => s.restoreSession);
  const setOnlineStatus = useSessionSyncStore((s) => s.setOnlineStatus);

  useEffect(() => {
    if (loaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, fontError]);

  useEffect(() => {
    // Restore auth session first, then set up online listener
    const initializeApp = async () => {
      await restoreSession();
      // After auth is restored, set up online listener
      const unsubscribe = NetInfo.addEventListener((state) => {
        setOnlineStatus(state.isConnected ?? false);
      });
      return unsubscribe;
    };

    let cleanup: (() => void) | null = null;
    initializeApp()
      .then((unsub) => {
        cleanup = unsub;
      })
      .catch((err) => {
        console.error("Failed to initialize app:", err);
      });

    return () => {
      if (cleanup) cleanup();
    };
  }, [restoreSession, setOnlineStatus]);

  if (!loaded && !fontError) {
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
