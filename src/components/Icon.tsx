/**
 * Centralized icon component using Ionicons from @expo/vector-icons.
 * Always use ICONS constants — never pass raw strings directly.
 * This prevents invalid icon names from silently rendering blank.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';

export const ICONS = {
  // Tab navigation
  home: 'home' as const,
  homeOutline: 'home-outline' as const,
  barbell: 'barbell' as const,
  barbellOutline: 'barbell-outline' as const,
  statsChart: 'stats-chart' as const,
  statsChartOutline: 'stats-chart-outline' as const,
  person: 'person' as const,
  personOutline: 'person-outline' as const,
  // App header
  flash: 'flash' as const,
  // Navigation
  arrowBack: 'arrow-back' as const,
  // Audio
  volumeHigh: 'volume-high' as const,
  volumeMute: 'volume-mute' as const,
  // Status
  checkmark: 'checkmark-circle' as const,
  warning: 'warning' as const,
  close: 'close' as const,
  // Fitness
  walk: 'walk' as const,
};

// Derive the allowed name type from the ICONS values
type IconName = (typeof ICONS)[keyof typeof ICONS];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color = '#ffffff' }: Props) {
  return (
    <Ionicons
      allowFontScaling={false}
      name={name as React.ComponentProps<typeof Ionicons>['name']}
      size={size}
      color={color}
    />
  );
}
