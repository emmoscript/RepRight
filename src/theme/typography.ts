/**
 * typography.ts — RepRight type scale
 * Font: Inter (or SF Pro system font on iOS)
 */

export const typography = {
  fontFamily: {
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
  },
  fontSize: {
    xs:      11,
    sm:      13,
    md:      15,
    lg:      17,
    xl:      20,
    xxl:     24,
    display: 32,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;
