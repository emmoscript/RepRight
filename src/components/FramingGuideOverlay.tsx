import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import type { ContainRect } from '@/utils/previewContainRect';
import type { FramingHint } from '@/utils/framingGuide';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const WIDTH_FRAC = 0.76;
/** Height as a fraction of the usable band (below header, above bottom margin). */
const HEIGHT_FRAC = 0.92;
const PREVIEW_EDGE = 14;

type Props = {
  containRect: ContainRect;
  /** Screen-space px: bottom of the top scrim / header (do not overlap). */
  topReservePx: number;
  visible: boolean;
  hint: FramingHint;
};

export function FramingGuideOverlay({ containRect, topReservePx, visible, hint }: Props) {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (!visible || hint === 'center') {
      pulse.value = withTiming(hint === 'center' ? 0.95 : 0.55, { duration: 220 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 700 }), withTiming(0.45, { duration: 700 })),
      -1,
    );
  }, [visible, hint, pulse]);

  const zoneProps = useAnimatedProps(() => ({
    strokeOpacity: pulse.value,
  }));

  const geometry = useMemo(() => {
    const { ox, oy, vw, vh } = containRect;
    if (vw < 8 || vh < 8) return null;

    const edge = PREVIEW_EDGE;
    const bandTop = Math.max(edge, topReservePx - oy + edge);
    const bandBottom = vh - edge;
    const bandH = Math.max(120, bandBottom - bandTop);
    const bandCenterY = bandTop + bandH / 2;

    const maxHalf = Math.min(bandCenterY - bandTop, bandBottom - bandCenterY);
    let zh = Math.min(bandH * HEIGHT_FRAC, maxHalf * 2);
    const minH = Math.max(140, bandH * 0.42);
    zh = Math.max(minH, Math.min(zh, maxHalf * 2));

    const zy = bandCenterY - zh / 2;
    const zw = Math.min(vw * WIDTH_FRAC, vw - edge * 2);
    const zx = (vw - zw) / 2;

    return { ox, oy, vw, vh, zx, zy, zw, zh };
  }, [containRect, topReservePx]);

  if (!visible || !geometry) return null;

  const { ox, oy, vw, vh, zx, zy, zw, zh } = geometry;
  const stroke = hint === 'center' ? colors.primary_green : colors.text_secondary;
  const dash = `${Math.max(6, vw * 0.018)} ${Math.max(4, vw * 0.012)}`;
  const corner = Math.max(12, vw * 0.032);
  const bracket = Math.max(16, vw * 0.045);

  const hintLabel =
    hint === 'left' ? '← Step left' : hint === 'right' ? 'Step right →' : hint === 'center' ? 'Centered' : null;

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { left: ox, top: oy, width: vw, height: vh }]}
    >
      <Svg width={vw} height={vh}>
        <AnimatedRect
          animatedProps={zoneProps}
          x={zx}
          y={zy}
          width={zw}
          height={zh}
          rx={corner}
          ry={corner}
          fill="rgba(39,195,79,0.05)"
          stroke={stroke}
          strokeWidth={2.5}
          strokeDasharray={dash}
        />
        <Line x1={zx} y1={zy + bracket} x2={zx} y2={zy} stroke={stroke} strokeWidth={3} strokeOpacity={0.9} />
        <Line x1={zx} y1={zy} x2={zx + bracket} y2={zy} stroke={stroke} strokeWidth={3} strokeOpacity={0.9} />
        <Line
          x1={zx + zw - bracket}
          y1={zy}
          x2={zx + zw}
          y2={zy}
          stroke={stroke}
          strokeWidth={3}
          strokeOpacity={0.9}
        />
        <Line x1={zx + zw} y1={zy} x2={zx + zw} y2={zy + bracket} stroke={stroke} strokeWidth={3} strokeOpacity={0.9} />
        <Line
          x1={zx}
          y1={zy + zh - bracket}
          x2={zx}
          y2={zy + zh}
          stroke={stroke}
          strokeWidth={3}
          strokeOpacity={0.9}
        />
        <Line
          x1={zx}
          y1={zy + zh}
          x2={zx + bracket}
          y2={zy + zh}
          stroke={stroke}
          strokeWidth={3}
          strokeOpacity={0.9}
        />
        <Line
          x1={zx + zw - bracket}
          y1={zy + zh}
          x2={zx + zw}
          y2={zy + zh}
          stroke={stroke}
          strokeWidth={3}
          strokeOpacity={0.9}
        />
        <Line
          x1={zx + zw}
          y1={zy + zh - bracket}
          x2={zx + zw}
          y2={zy + zh}
          stroke={stroke}
          strokeWidth={3}
          strokeOpacity={0.9}
        />
      </Svg>

      {hintLabel ? (
        <View
          style={[
            styles.hintPill,
            hint === 'center' && styles.hintPillOk,
            { top: zy + 12, left: zx + zw * 0.1, width: zw * 0.8 },
          ]}
        >
          <Text style={[styles.hintTxt, hint === 'center' && styles.hintTxtOk]}>{hintLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    zIndex: 1,
    elevation: 0,
  },
  hintPill: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,13,0.72)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(72,72,71,0.55)',
  },
  hintPillOk: {
    borderColor: colors.primary_green,
    backgroundColor: colors.green_subtle_bg,
  },
  hintTxt: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodySm,
  },
  hintTxtOk: {
    color: colors.primary_green,
  },
});
