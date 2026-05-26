import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList } from '@/navigation/routeTypes';
import { WorkoutStackNavigator } from '@/navigation/WorkoutStackNavigator';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { StatsScreen } from '@/screens/StatsScreen';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type { MainTabParamList };

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_BASE = 64;

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  const tabBarHeight = TAB_BAR_BASE + Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 10,
          },
        ],
        tabBarActiveTintColor: colors.primary_green,
        tabBarInactiveTintColor: colors.tab_inactive,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              allowFontScaling={false}
              name={focused ? 'home' : 'home-outline'}
              size={size ?? 26}
              color={color ?? colors.tab_inactive}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutStackNavigator}
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              allowFontScaling={false}
              name={focused ? 'barbell' : 'barbell-outline'}
              size={size ?? 26}
              color={color ?? colors.tab_inactive}
            />
          ),
        }}
      />
      <Tab.Screen
        name="StatsMain"
        component={StatsScreen}
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              allowFontScaling={false}
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size ?? 26}
              color={color ?? colors.tab_inactive}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              allowFontScaling={false}
              name={focused ? 'person' : 'person-outline'}
              size={size ?? 26}
              color={color ?? colors.tab_inactive}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.nav_bar_bg,
    borderTopColor: colors.border_subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarLabel: {
    fontFamily: typography.fontFamily.display,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.capsWide,
    marginBottom: 0,
  },
});
