/**
 * Font-free UI glyphs (react-native-svg). Use where @expo/vector-icons fonts fail on device.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Glyphs = { color: string; size?: number };

/** Horizontal barbell plate + bar plate (readable at 24–72px). */
export function SvgDumbbellIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="6.75" cy="12" r="4.25" fill={color} />
      <Circle cx="17.25" cy="12" r="4.25" fill={color} />
      <Rect x="9.25" y="10.05" width="5.5" height="3.9" rx="1" fill={color} />
    </Svg>
  );
}

/** Photo / camera body + lens (24dp). */
export function SvgCameraIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M9 4L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.17L15 4H9zm3 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </Svg>
  );
}

export function SvgPlayIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5v14l11-7z" />
    </Svg>
  );
}

export function SvgBoltIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 2v11h3v9l7-12h-4l4-8H7z" />
    </Svg>
  );
}

export function SvgArrowForwardIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
    </Svg>
  );
}

export function SvgTrendingUpIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" />
    </Svg>
  );
}

export function SvgInfoOutlineIcon({ color, size = 24 }: Glyphs) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
      />
    </Svg>
  );
}
