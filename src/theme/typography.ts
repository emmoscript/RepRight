/**
 * RepRight typography — Design System v3
 * Display: Space Grotesk Bold. Body / labels: Inter.
 * @see docs/design-system/design-system-v3.md
 */

export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    display: 'SpaceGrotesk_700Bold',
  },
  fontSize: {
    /** Uppercase meta labels */
    captionCaps: 10,
    captions: 12,
    bodySm: 14,
    body: 16,
    bodyLg: 18,
    titleSm: 24,
    cardHeading: 32,
    /** Screen titles */
    screenTitle: 40,
    hero: 48,
    /** Legacy aliases */
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 40,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },
  letterSpacing: {
    capsWide: 2,
    capsWider: 3,
  },
} as const;
