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
  AuthGateway: undefined;
  Login: undefined;
  Signup: undefined;
  EmailConfirm: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** `continuedWorkout`: next set — do not reset workout index / cleared in {@link advanceToNextSet}. */
  LiveSession: { continuedWorkout?: boolean } | undefined;
  SessionComplete: undefined;
};

export type MainTabCompositeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
