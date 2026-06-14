import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthDeepLink } from '@/hooks/useAuthDeepLink';
import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import { flushPendingAuthNavigation, navigationRef } from '@/navigation/navigationRef';
import type { RootStackParamList, MainTabParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { DemoScreen } from '@/screens/DemoScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { AuthGatewayScreen } from '@/screens/AuthGatewayScreen';
import { EmailConfirmScreen } from '@/screens/EmailConfirmScreen';
import { LiveSessionScreen } from '@/screens/LiveSessionScreen';
import { SessionCompleteScreen } from '@/screens/SessionCompleteScreen';
import { SessionDetailScreen } from '@/screens/SessionDetailScreen';
import { LegalDocumentScreen } from '@/screens/LegalDocumentScreen';
import { SupportScreen } from '@/screens/SupportScreen';
import { BiomechSurveyScreen } from '@/screens/BiomechSurveyScreen';
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
        <Stack.Screen name="Demo" component={DemoScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="AuthGateway" component={AuthGatewayScreen} />
        <Stack.Screen name="EmailConfirm" component={EmailConfirmScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="LiveSession" component={LiveSessionScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SessionComplete" component={SessionCompleteScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
        <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="BiomechSurvey" component={BiomechSurveyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
