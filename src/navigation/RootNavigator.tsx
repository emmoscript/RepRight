import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/theme/colors';
import { LoginScreen } from '@/screens/LoginScreen';
import { SignupScreen } from '@/screens/SignupScreen';
import { EmailConfirmScreen } from '@/screens/EmailConfirmScreen';
import { DemoScreen } from '@/screens/DemoScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { ConfigureSessionScreen } from '@/screens/ConfigureSessionScreen';
import { LiveSessionScreen } from '@/screens/LiveSessionScreen';
import { SessionCompleteScreen } from '@/screens/SessionCompleteScreen';

export type RootStackParamList = {
  Demo: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  EmailConfirm: undefined;
  MainTabs: undefined;
  HomeMain: undefined;
  Stats: undefined;
  Profile: undefined;
  ConfigureSession: undefined;
  LiveSession: undefined;
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
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName="Demo"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg_v3 },
          headerTintColor: colors.text_primary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg_v3 },
        }}
      >
        <Stack.Screen name="Demo" component={DemoScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'RepRight' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign up' }} />
        <Stack.Screen
          name="EmailConfirm"
          component={EmailConfirmScreen}
          options={{ title: 'Confirm email' }}
        />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Stats' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen
          name="ConfigureSession"
          component={ConfigureSessionScreen}
          options={{ title: 'Configure session' }}
        />
        <Stack.Screen
          name="LiveSession"
          component={LiveSessionScreen}
          options={{ title: 'Live', headerShown: false }}
        />
        <Stack.Screen
          name="SessionComplete"
          component={SessionCompleteScreen}
          options={{ title: 'Session complete', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
