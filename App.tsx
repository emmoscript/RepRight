import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Font from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/navigation/RootNavigator';

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

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Font.loadAsync(APP_FONT_MAP);
      } catch (e) {
        if (__DEV__) {
          console.warn('Font.loadAsync failed; icon fonts may flash until loaded:', e);
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

  if (!fontsReady) {
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
