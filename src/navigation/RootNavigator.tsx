import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import type { RootStackParamList, MainTabParamList } from '@/navigation/routeTypes';
import { DemoScreen } from '@/screens/DemoScreen';
import { AuthGatewayScreen } from '@/screens/AuthGatewayScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { EmailConfirmScreen } from '@/screens/EmailConfirmScreen';
import { LiveSessionScreen } from '@/screens/LiveSessionScreen';
import { SessionCompleteScreen } from '@/screens/SessionCompleteScreen';
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

export function RootNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName="Demo"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg_v3 },
          headerTintColor: colors.text_primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg_v3 },
          headerShown: false,
        }}
      >
        <Stack.Screen name="Demo" component={DemoScreen} />
        <Stack.Screen name="AuthGateway" component={AuthGatewayScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="EmailConfirm" component={EmailConfirmScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="LiveSession" component={LiveSessionScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SessionComplete" component={SessionCompleteScreen} options={{ gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
