import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Props = { color: string; size?: number };

/** Vector tab icons — avoids Ionicon fonts that stayed blank on some Android builds (Samsung). */

export function TabHomeIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
    </Svg>
  );
}

export function TabWorkoutIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={6} cy={12} r={3} />
      <Rect x={9} y={10} width={6} height={4} rx={1} />
      <Circle cx={18} cy={12} r={3} />
    </Svg>
  );
}

export function TabStatsIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M4 20h3v-9H4v9zm6 0h3V4h-3v16zm6 0h3v-7h-3v7z" />
    </Svg>
  );
}

export function TabProfileIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}
