/**
 * Centralized icon component — Ionicons from `@expo/vector-icons` (Expo-supported).
 * Use ICONS constants so invalid glyph names fail fast at type-check time.
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
  // Demo / onboarding
  videocam: 'videocam' as const,
  videocamOutline: 'videocam-outline' as const,
  arrowForward: 'arrow-forward' as const,
  arrowForwardCircle: 'arrow-forward-circle' as const,
  informationOutline: 'information-circle-outline' as const,
  informationCircle: 'information-circle' as const,
  phonePortraitOutline: 'phone-portrait-outline' as const,
  sparklesOutline: 'sparkles-outline' as const,
};

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
