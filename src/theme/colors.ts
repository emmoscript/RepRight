/**
 * RepRight color tokens — Design System v3 FINAL
 * @see docs/design-system/design-system-v3.md
 */
export const colors = {
  // Primary green
  primary_green: '#27C34F',
  accent_green_light: '#5FF075',
  accent_green_dim: '#1FBF4B',
  green_subtle_bg: '#002F0B',
  green_glow: 'rgba(39,195,79,0.2)',

  // Backgrounds
  bg_v3: '#0D0D0D',
  bg_surface_alt: '#0E0E0E',
  surface_v3: '#1A1919',
  bg_elevated: '#201F1F',
  bg_high: '#262626',
  bg_highest: '#262626',
  nav_bar_bg: '#131313',
  surface_low: '#131313',

  // Semantic
  accent_red: '#FF4444',
  error_alt: '#FF716C',
  error_container: '#9F0519',
  accent_yellow: '#FFB800',

  // Score
  score_excellent: '#27C34F',
  score_good: '#5FF075',
  score_needswork: '#FFB800',
  score_poor: '#FF4444',

  // Text (v3)
  text_primary: '#FFFFFF',
  text_secondary: '#ADAAAA',
  text_muted: '#767575',
  text_on_green: '#000000',
  text_on_error: '#FFFFFF',

  // Skeleton (v3)
  skeleton_active: '#27C34F',
  skeleton_error: '#FF4444',
  skeleton_muted_v3: '#484847',

  // Borders
  border_subtle: '#484847',
  border_medium: '#484847',
  border_active: '#27C34F',

  // Legacy aliases — map to v3 so existing imports stay valid
  bg_primary: '#0D0D0D',
  bg_surface: '#1A1919',
  bg_highest_compat: '#262626',
  error: '#FF4444',
  error_subtle: '#9F0519',
  warning: '#FFB800',
  skeleton_muted: '#484847',
  accent_orange: '#27C34F',
  accent_orange_light: '#5FF075',
  accent_orange_dim: '#1FBF4B',
  accent_orange_subtle: '#002F0B',
  accent_orange_glow: 'rgba(39,195,79,0.15)',
  text_on_orange: '#000000',
  text_on_white: '#FFFFFF',
  warning_subtle: '#331E00',

  tab_inactive: '#888888',
} as const;

export type ColorKey = keyof typeof colors;
