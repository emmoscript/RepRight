/**
 * RepRight color tokens — v2 (Orange warm dark theme)
 * Matches the final Stitch design system.
 */
export const colors = {
  // Backgrounds
  bg_primary:    '#111010',   // warm dark gray base
  bg_surface:    '#1A1917',   // surface cards
  bg_elevated:   '#222019',   // elevated cards
  bg_high:       '#2A2825',
  bg_highest:    '#323029',

  // v3 (README) + compatibility aliases used by feedback / live UI
  primary_green: '#27C34F',
  bg_v3: '#0D0D0D',
  surface_v3: '#1A1919',
  accent_red: '#FF4444',
  accent_yellow: '#FFB800',
  skeleton_muted_v3: '#484847',
  // Primary accent — orange (v2)
  accent_orange:        '#F08030',
  accent_orange_light:  '#FFB68B',
  accent_orange_dim:    '#C4682A',
  accent_orange_subtle: '#2D1E0F',
  accent_orange_glow:   'rgba(240,128,48,0.15)',

  // Semantic
  error:           '#E84040',
  error_subtle:    '#3D0F0F',
  warning:         '#F0C040',   // yellow — NOT orange
  warning_subtle:  '#3D2800',

  // Score
  score_excellent: '#27C34F',   // 90–100
  score_good:      '#5CB85C',   // 70–89
  score_needswork: '#F0C040',   // 50–69
  score_poor:      '#E84040',   // <50

  // Text
  text_primary:   '#F0EDE8',
  text_secondary: '#9A9590',
  text_muted:     '#5A5550',
  text_on_orange: '#FFFFFF',
  text_on_white:  '#111010',

  // Skeleton overlay
  skeleton_active: '#F08030',   // detected / tracking
  skeleton_error:  '#E84040',   // error keypoint
  skeleton_muted:  '#5A5550',   // positioning (not detected)

  // Borders
  border_subtle: '#222019',
  border_medium: '#2A2825',
  border_active: '#F08030',
} as const;

export type ColorKey = keyof typeof colors;
