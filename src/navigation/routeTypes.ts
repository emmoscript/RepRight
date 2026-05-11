import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Bottom tabs — aligned with docs/screens.md */
export type MainTabParamList = {
  HomeMain: undefined;
  Workout: undefined;
  StatsMain: undefined;
  ProfileMain: undefined;
};

/** Root native stack — auth flows + overlay screens */
export type RootStackParamList = {
  Demo: undefined;
  Login: undefined;
  Signup: undefined;
  EmailConfirm: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  LiveSession: undefined;
  SessionComplete: undefined;
};

export type MainTabCompositeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
