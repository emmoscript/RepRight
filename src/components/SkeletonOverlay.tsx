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
};

export function SkeletonOverlay({ width, height, keypoints, lineColor, pointColor }: Props) {
  const lines = useMemo(() => {
    if (!keypoints || keypoints.length < 17) return null;
    return MOVENET_SKELETON_EDGES.map(([a, b], i) => {
      const p1 = keypoints[a];
      const p2 = keypoints[b];
      if (!p1 || !p2) return null;
      return (
        <Line
          key={i}
          x1={p1.x * width}
          y1={p1.y * height}
          x2={p2.x * width}
          y2={p2.y * height}
          stroke={lineColor}
          strokeWidth={2}
        />
      );
    });
  }, [keypoints, width, height, lineColor]);

  const points = useMemo(() => {
    if (!keypoints) return null;
    return keypoints.map((k, i) => (
      <Circle
        key={i}
        cx={k.x * width}
        cy={k.y * height}
        r={3}
        fill={pointColor}
      />
    ));
  }, [keypoints, width, height, pointColor]);

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
