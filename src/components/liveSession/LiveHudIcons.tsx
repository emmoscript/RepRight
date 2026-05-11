import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

type Props = { color: string; size?: number };

/** Ionicons `volume-high-outline` speaker body (Apache-2.0). */
const ION_VOL_SPEAKER_OUTLINE_D =
  'M126,192H56a8,8,0,0,0-8,8V312a8,8,0,0,0,8,8h69.65a15.93,15.93,0,0,1,10.14,3.54l91.47,74.89A8,8,0,0,0,240,392V120a8,8,0,0,0-12.74-6.43l-91.47,74.89A15,15,0,0,1,126,192Z';

/** Ionicons `volume-mute-outline` v7.4 (Apache-2.0), distinct art from `volume-high-outline`. */
const ION_VOL_MUTE_O_D1 =
  'M224,136.92v33.8a4,4,0,0,0,1.17,2.82l24,24a4,4,0,0,0,6.83-2.82V120.57a24.53,24.53,0,0,0-12.67-21.72a23.91,23.91,0,0,0-25.55,1.83a8.27,8.27,0,0,0-.66.51l-31.94,26.15a4,4,0,0,0-.29,5.92l17.05,17.06a4,4,0,0,0,5.37.26Z';
const ION_VOL_MUTE_O_D2 =
  'M224,375.08l-78.07-63.92A32,32,0,0,0,125.65,304H64V208h50.72a4,4,0,0,0,2.82-6.83l-24-24A4,4,0,0,0,90.72,176H56a24,24,0,0,0-24,24V312a24,24,0,0,0,24,24h69.76l91.36,74.8a8.27,8.27,0,0,0,.66.51A23.93,23.93,0,0,0,243.63,413A24.49,24.49,0,0,0,256,391.45V341.28a4,4,0,0,0-1.17-2.82l-24-24a4,4,0,0,0-6.83,2.82ZM125.82,336Z';
const ION_VOL_MUTE_O_D3 =
  'M352,256c0-24.56-5.81-47.88-17.75-71.27a16,16,0,0,0-28.5,14.54C315.34,218.06,320,236.62,320,256q0,4-.31,8.13a8,8,0,0,0,2.32,6.25l19.66,19.67a4,4,0,0,0,6.75-2A146.89,146.89,0,0,0,352,256Z';
const ION_VOL_MUTE_O_D4 =
  'M416,256c0-51.19-13.08-83.89-34.18-120.06a16,16,0,0,0-27.64,16.12C373.07,184.44,384,211.83,384,256c0,23.83-3.29,42.88-9.37,60.65a8,8,0,0,0,1.9,8.26l16.77,16.76a4,4,0,0,0,6.52-1.27C410.09,315.88,416,289.91,416,256Z';
const ION_VOL_MUTE_O_D5 =
  'M480,256c0-74.26-20.19-121.11-50.51-168.61a16,16,0,1,0-27,17.22C429.82,147.38,448,189.5,448,256c0,47.45-8.9,82.12-23.59,113a4,4,0,0,0,.77,4.55L443,391.39a4,4,0,0,0,6.4-1C470.88,348.22,480,307,480,256Z';

/** Stroke icons for live HUD — guaranteed visible without icon fonts (same issue as tabs on some devices). */

export function SvgChevronBack({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14 6l-6 6 6 6"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Ionicons `camera-reverse-outline` paths (Apache-2.0, ionic-team/ionicons).
 * Vector strokes — avoids Ionicons.ttf not rendering inside some native HUD layers.
 */
export function SvgCameraReverseOutline({ color, size = 22 }: Props) {
  const c = color;
  const sw = 32;
  const cap = 'round' as const;
  const join = 'round' as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path
        d="M350.54,148.68l-26.62-42.06C318.31,100.08,310.62,96,302,96H210c-8.62,0-16.31,4.08-21.92,10.62l-26.62,42.06C155.85,155.23,148.62,160,140,160H80a32,32,0,0,0-32,32V384a32,32,0,0,0,32,32H432a32,32,0,0,0,32-32V192a32,32,0,0,0-32-32H373C364.35,160,356.15,155.23,350.54,148.68Z"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Polyline
        points="124,158 124,136 100,136 100,158"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Path
        d="M335.76,285.22V271.91a80,80,0,0,0-131-61.6M176,258.78v13.31a80,80,0,0,0,130.73,61.8"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Polyline
        points="196,272 176,252 156,272"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Polyline
        points="356,272 336,292 316,272"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
    </Svg>
  );
}

export function SvgHudWalkPerson({ color, size = 26 }: Props) {
  const c = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5.2} r={2} stroke={c} strokeWidth={1.8} />
      <Path
        d="M12 8v5M9 13l3-2 3 2M10.8 13.2v6.2M13.2 13.2v6.2"
        stroke={c}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SvgHudCheckCircle({ color, size = 26 }: Props) {
  const c = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.75} stroke={c} strokeWidth={1.95} />
      <Path d="M7.8 12.2 10.5 15 16.5 9" stroke={c} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SvgHudWarnTriangle({ color, size = 22 }: Props) {
  const c = color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4.2 L3.5 18h17L12 4.2z" stroke={c} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M12 9v4.2 M12 16.8v0.4" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Ionicons `volume-high-outline` (Apache-2.0).
 */
export function SvgVolumeOn({ color, size = 22 }: Props) {
  const c = color;
  const sw = 32;
  const cap = 'round' as const;
  const join = 'round' as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Path
        d={ION_VOL_SPEAKER_OUTLINE_D}
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Path
        d="M320,320c9.74-19.38,16-40.84,16-64,0-23.48-6-44.42-16-64"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Path
        d="M368,368c19.48-33.92,32-64.06,32-112s-12-77.74-32-112"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
      <Path
        d="M416,416c30-46,48-91.43,48-160S446,143,416,96"
        fill="none"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeLinejoin={join}
      />
    </Svg>
  );
}

/**
 * Ionicons `volume-mute-outline` v7.4 (Apache-2.0) — full asset (filled speaker + arcs + stroked slash), not a composite of `volume-high`.
 */
export function SvgVolumeMuted({ color, size = 22 }: Props) {
  const c = color;
  const sw = 32;
  const cap = 'round' as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Line
        x1={416}
        y1={432}
        x2={64}
        y2={80}
        stroke={c}
        strokeWidth={sw}
        strokeLinecap={cap}
        strokeMiterlimit={10}
        fill="none"
      />
      <Path fill={c} stroke="none" d={ION_VOL_MUTE_O_D1} />
      <Path fill={c} stroke="none" d={ION_VOL_MUTE_O_D2} />
      <Path fill={c} stroke="none" d={ION_VOL_MUTE_O_D3} />
      <Path fill={c} stroke="none" d={ION_VOL_MUTE_O_D4} />
      <Path fill={c} stroke="none" d={ION_VOL_MUTE_O_D5} />
    </Svg>
  );
}
