import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { MOVENET_SKELETON_EDGES } from '@/constants/skeletonEdges';
import type { KeyPoint } from '@/modules/movenet';

type Props = {
  width: number;
  height: number;
  keypoints: KeyPoint[] | null;
  lineColor: string;
  pointColor: string;
  dynamicColors?: boolean;
};

function colorForScore(score: number): { line: string; point: string } {
  if (score >= 0.75) return { line: '#34D399', point: '#22D3EE' }; // green + cyan
  if (score >= 0.45) return { line: '#A78BFA', point: '#60A5FA' }; // purple + blue
  return { line: '#F97316', point: '#EF4444' }; // orange + red
}

export function SkeletonOverlay({
  width,
  height,
  keypoints,
  lineColor,
  pointColor,
  dynamicColors = true,
}: Props) {
  const lines = useMemo(() => {
    if (!keypoints || keypoints.length < 17) return null;
    return MOVENET_SKELETON_EDGES.map(([a, b], i) => {
      const p1 = keypoints[a];
      const p2 = keypoints[b];
      if (!p1 || !p2) return null;
      const conf = Math.min(p1.score, p2.score);
      const palette = dynamicColors ? colorForScore(conf) : { line: lineColor, point: pointColor };
      return (
        <Line
          key={i}
          x1={p1.x * width}
          y1={p1.y * height}
          x2={p2.x * width}
          y2={p2.y * height}
          stroke={palette.line}
          strokeWidth={conf >= 0.75 ? 3 : conf >= 0.45 ? 2.4 : 2}
          strokeOpacity={conf >= 0.45 ? 0.95 : 0.7}
        />
      );
    });
  }, [dynamicColors, keypoints, width, height, lineColor, pointColor]);

  const points = useMemo(() => {
    if (!keypoints) return null;
    return keypoints.map((k, i) => {
      const palette = dynamicColors ? colorForScore(k.score) : { line: lineColor, point: pointColor };
      return (
        <Circle
          key={i}
          cx={k.x * width}
          cy={k.y * height}
          r={k.score >= 0.75 ? 4 : k.score >= 0.45 ? 3.5 : 3}
          fill={palette.point}
          fillOpacity={k.score >= 0.45 ? 0.95 : 0.72}
        />
      );
    });
  }, [dynamicColors, keypoints, width, height, lineColor, pointColor]);

  if (!keypoints) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        {lines}
        {points}
      </Svg>
    </View>
  );
}
