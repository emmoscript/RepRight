import {
  DarkTheme,
  NavigationContainer,
  NavigatorScreenParams,
  type Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { MainTabParamList } from "@/navigation/routeTypes";
import { DemoScreen } from "@/screens/DemoScreen";
import { EmailConfirmScreen } from "@/screens/EmailConfirmScreen";
import { LiveSessionScreen } from "@/screens/LiveSessionScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { SessionCompleteScreen } from "@/screens/SessionCompleteScreen";
import { SignupScreen } from "@/screens/SignupScreen";
import { selectIsLoggedIn, useAuthStore } from "@/store/authStore";
import { colors } from "@/theme/colors";

export type RootStackParamList = {
  Demo: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  EmailConfirm: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  LiveSession: { continuedWorkout?: boolean } | undefined;
  SessionComplete: undefined;
};

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg_v3,
    card: colors.surface_v3,
    primary: colors.primary_green,
    text: colors.text_primary,
    border: colors.border_subtle,
    notification: colors.accent_red,
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg_v3,
        }}>
        <ActivityIndicator size="large" color={colors.primary_green} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName={isLoggedIn ? "MainTabs" : "Demo"}
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg_v3 },
          headerTintColor: colors.text_primary,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.bg_v3 },
        }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Demo"
              component={DemoScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ title: "Log in" }}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{ title: "Sign up" }}
            />
            <Stack.Screen
              name="EmailConfirm"
              component={EmailConfirmScreen}
              options={{ title: "Confirm email" }}
            />
          </>
        )}
        {/* Overlay screens - available in both authenticated and unauthenticated flows */}
        <Stack.Screen
          name="LiveSession"
          component={LiveSessionScreen}
          options={{ title: "Live", headerShown: false }}
        />
        <Stack.Screen
          name="SessionComplete"
          component={SessionCompleteScreen}
          options={{ title: "Session Complete" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
