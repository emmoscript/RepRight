import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthDeepLink } from '@/hooks/useAuthDeepLink';
import { flushPendingAuthNavigation, navigationRef } from '@/navigation/navigationRef';
import type { RootStackParamList, MainTabParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- RN recommended typing bridge
  namespace ReactNavigation {
    // Merge root stack routes for `useNavigation()` typing site-wide (React Navigation convention).
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

export type { RootStackParamList, MainTabParamList };

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

function AuthLinkHandler() {
  useAuthDeepLink();
  return null;
}

function resolveInitialRoute(isLoggedIn: boolean, onboardingCompleted: boolean): keyof RootStackParamList {
  if (isLoggedIn) return 'MainTabs';
  if (onboardingCompleted) return 'Welcome';
  return 'Demo';
}

export function RootNavigator() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const onboardingCompleted = useUserPreferencesStore((s) => s.onboardingCompleted);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      onReady={() => flushPendingAuthNavigation(isLoggedIn)}
    >
      <AuthLinkHandler />
      <Stack.Navigator
        initialRouteName={resolveInitialRoute(isLoggedIn, onboardingCompleted)}
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg_v3 },
          headerTintColor: colors.text_primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg_v3 },
          headerShown: false,
        }}
      >
        <Stack.Screen name="Demo" getComponent={() => require('@/screens/DemoScreen').DemoScreen} />
        <Stack.Screen name="Welcome" getComponent={() => require('@/screens/WelcomeScreen').WelcomeScreen} />
        <Stack.Screen
          name="AuthGateway"
          getComponent={() => require('@/screens/AuthGatewayScreen').AuthGatewayScreen}
        />
        <Stack.Screen
          name="EmailConfirm"
          getComponent={() => require('@/screens/EmailConfirmScreen').EmailConfirmScreen}
        />
        <Stack.Screen
          name="MainTabs"
          getComponent={() => require('@/navigation/MainTabNavigator').MainTabNavigator}
        />
        <Stack.Screen
          name="LiveSession"
          getComponent={() => require('@/screens/LiveSessionScreen').LiveSessionScreen}
          options={{ gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="SessionComplete"
          getComponent={() => require('@/screens/SessionCompleteScreen').SessionCompleteScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="SessionDetail"
          getComponent={() => require('@/screens/SessionDetailScreen').SessionDetailScreen}
        />
        <Stack.Screen
          name="LegalDocument"
          getComponent={() => require('@/screens/LegalDocumentScreen').LegalDocumentScreen}
        />
        <Stack.Screen name="Support" getComponent={() => require('@/screens/SupportScreen').SupportScreen} />
        <Stack.Screen
          name="BiomechSurvey"
          getComponent={() => require('@/screens/BiomechSurveyScreen').BiomechSurveyScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
