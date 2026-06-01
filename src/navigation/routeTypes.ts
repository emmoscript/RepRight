import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Nested stack inside the Workout tab — one configure screen per exercise. */
export type WorkoutStackParamList = {
  WorkoutHome: undefined;
  DeadliftConfigure: undefined;
};

/** Bottom tabs — aligned with docs/screens.md */
export type MainTabParamList = {
  HomeMain: undefined;
  Workout: NavigatorScreenParams<WorkoutStackParamList> | undefined;
  StatsMain: undefined;
  ProfileMain: undefined;
};

/** Root native stack — auth flows + overlay screens */
export type RootStackParamList = {
  Demo: undefined;
  /** Auth entry for returning users (after sign-out). Not the first-run onboarding. */
  Welcome: undefined;
  AuthGateway: undefined;
  Login: undefined;
  Signup: undefined;
  EmailConfirm: { email: string };
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** `continuedWorkout`: next set — do not reset workout index / cleared in {@link advanceToNextSet}. */
  LiveSession: { continuedWorkout?: boolean } | undefined;
  SessionComplete: undefined;
  SessionDetail: { sessionId: string };
};

export type MainTabCompositeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type WorkoutStackNav = CompositeNavigationProp<
  NativeStackNavigationProp<WorkoutStackParamList>,
  MainTabCompositeNav
>;
