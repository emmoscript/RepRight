import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import {
  MOVENET_SKELETON_EDGES,
  keypointRenderableByGroup,
  skeletonGroupActivation,
} from '@/constants/skeletonEdges';
import { MIN_KEYPOINT_SCORE, type KeyPoint } from '@/modules/movenet';
import type { ContainRect } from '@/utils/previewContainRect';

const LEFT_SIDE_IDX = new Set([1, 3, 5, 7, 9, 11, 13, 15]);
const RIGHT_SIDE_IDX = new Set([2, 4, 6, 8, 10, 12, 14, 16]);

const LEFT_CHAIN = [5, 7, 9, 11, 13, 15];
const RIGHT_CHAIN = [6, 8, 10, 12, 14, 16];

/** Chain score gap before hiding the weak side in profile (lower = less “missing leg”). */
const SIDE_DOM_DELTA = 0.08;

/** MoveNet confidences run low in motion; tuned so mid-confidence reads as purple, not only orange. */
const TIER_GREEN = 0.68;
const TIER_PURPLE = 0.38;

type Props = {
  /** Full-screen layout box (Svg matches this); keypoints map into {@link containRect} if set. */
  width: number;
  height: number;
  /** When preview uses `resizeMode="contain"`, pass the same rect as LiveSession (letterbox). */
  containRect?: ContainRect | null;
  keypoints: KeyPoint[] | null;
  lineColor: string;
  pointColor: string;
  /** When true: colorises by keypoint confidence (green/purple/orange). Default true. */
  dynamicColors?: boolean;
  /** Do not draw joints below this score unless a body group “fills” weak KPs. Default {@link MIN_KEYPOINT_SCORE}. */
  minKeypointScore?: number;
  /** If any KP in face / torso(+arms+hips) / legs passes {@link groupTriggerScore}, draw that whole subgraph. */
  groupOrchestratedFill?: boolean;
  /** Min score to activate a group’s full subgraph (slightly below limb threshold so a single eye can unlock the face mesh). */
  groupTriggerScore?: number;
  /** If one side clearly faces the camera, hide the opposite limb visually (analyzer still sees full pose). */
  suppressWeakSide?: boolean;
};

function confidenceColor(score: number): { line: string; point: string } {
  if (score >= TIER_GREEN) return { line: '#34D399', point: '#22D3EE' };
  if (score >= TIER_PURPLE) return { line: '#A78BFA', point: '#60A5FA' };
  return { line: '#F97316', point: '#EF4444' };
}

const PREDICTED_MUTE = { line: '#F97316', point: '#EF4444', opacity: 0.45 };

function isPredicted(k: KeyPoint): boolean {
  return k.source === 'predicted';
}

function avgChainScore(keypoints: KeyPoint[], ids: readonly number[]): number {
  let s = 0;
  for (const id of ids) {
    s += keypoints[id]?.score ?? 0;
  }
  return s / ids.length;
}

/** Index is hidden for rendering when modelling a side-facing deadlift (face KPs are never suppressed). */
function indexHiddenByDominance(idx: number, hideLeft: boolean, hideRight: boolean): boolean {
  if (idx >= 0 && idx <= 4) return false;
  if (hideLeft && LEFT_SIDE_IDX.has(idx)) return true;
  if (hideRight && RIGHT_SIDE_IDX.has(idx)) return true;
  return false;
}

export function SkeletonOverlay({
  width,
  height,
  containRect,
  keypoints,
  lineColor,
  pointColor,
  dynamicColors = true,
  minKeypointScore = MIN_KEYPOINT_SCORE,
  groupOrchestratedFill = true,
  groupTriggerScore = 0.28,
  suppressWeakSide = true,
}: Props) {
  const rect =
    containRect ?? ({ ox: 0, oy: 0, vw: width, vh: height } satisfies ContainRect);

  const toPx = useMemo(() => {
    return (kx: number, ky: number) => ({
      x: rect.ox + kx * rect.vw,
      y: rect.oy + ky * rect.vh,
    });
  }, [rect.ox, rect.oy, rect.vw, rect.vh]);

  const dominance = useMemo(() => {
    if (!suppressWeakSide || !keypoints || keypoints.length < 17) {
      return { hideLeft: false, hideRight: false };
    }
    const la = avgChainScore(keypoints, LEFT_CHAIN);
    const ra = avgChainScore(keypoints, RIGHT_CHAIN);
    if (la >= ra + SIDE_DOM_DELTA) return { hideLeft: false, hideRight: true };
    if (ra >= la + SIDE_DOM_DELTA) return { hideLeft: true, hideRight: false };
    return { hideLeft: false, hideRight: false };
  }, [keypoints, suppressWeakSide]);

  const groupActivation = useMemo(
    () =>
      keypoints && groupOrchestratedFill
        ? skeletonGroupActivation(keypoints, groupTriggerScore)
        : { face: false, torso: false, legs: false },
    [keypoints, groupOrchestratedFill, groupTriggerScore],
  );

  const pointVisible = useMemo(() => {
    const vis: boolean[] = new Array(17).fill(false);
    if (!keypoints) return vis;
    for (let i = 0; i < 17; i += 1) {
      const k = keypoints[i];
      if (!k) continue;
      if (indexHiddenByDominance(i, dominance.hideLeft, dominance.hideRight)) continue;

      const aboveCutoff = k.score >= minKeypointScore;
      const groupFillOk = keypointRenderableByGroup(i, groupActivation, groupOrchestratedFill);

      if (aboveCutoff || groupFillOk) vis[i] = true;
    }
    return vis;
  }, [
    keypoints,
    minKeypointScore,
    groupOrchestratedFill,
    groupActivation,
    dominance.hideLeft,
    dominance.hideRight,
  ]);

  const lines = useMemo(() => {
    if (!keypoints || keypoints.length < 17) return null;
    return MOVENET_SKELETON_EDGES.map(([a, b], i) => {
      if (!pointVisible[a] || !pointVisible[b]) return null;
      const p1 = keypoints[a];
      const p2 = keypoints[b];
      if (!p1 || !p2) return null;
      const conf = Math.min(p1.score, p2.score);
      const muted = isPredicted(p1) || isPredicted(p2);
      const color = muted
        ? PREDICTED_MUTE.line
        : dynamicColors
          ? confidenceColor(conf).line
          : lineColor;
      const opacity = muted
        ? PREDICTED_MUTE.opacity
        : dynamicColors
          ? conf >= TIER_PURPLE
            ? 0.95
            : 0.72
          : conf >= 0.3
            ? 0.9
            : 0.4;
      const strokeW = muted ? 2 : conf >= TIER_GREEN ? 3 : conf >= TIER_PURPLE ? 2.5 : 2;
      const A = toPx(p1.x, p1.y);
      const B = toPx(p2.x, p2.y);
      return (
        <Line
          key={i}
          x1={A.x}
          y1={A.y}
          x2={B.x}
          y2={B.y}
          stroke={color}
          strokeWidth={strokeW}
          strokeOpacity={opacity}
        />
      );
    });
  }, [dynamicColors, keypoints, lineColor, pointVisible, toPx]);

  const points = useMemo(() => {
    if (!keypoints) return null;
    return keypoints.map((k, i) => {
      if (!pointVisible[i]) return null;
      const muted = isPredicted(k);
      const color = muted
        ? PREDICTED_MUTE.point
        : dynamicColors
          ? confidenceColor(k.score).point
          : pointColor;
      const opacity = muted
        ? PREDICTED_MUTE.opacity
        : dynamicColors
          ? k.score >= TIER_PURPLE
            ? 0.95
            : 0.72
          : k.score >= 0.3
            ? 0.92
            : 0.35;
      const r = muted ? 3 : k.score >= TIER_GREEN ? 4.5 : k.score >= TIER_PURPLE ? 3.5 : 3;
      const P = toPx(k.x, k.y);
      return (
        <Circle key={i} cx={P.x} cy={P.y} r={r} fill={color} fillOpacity={opacity} />
      );
    });
  }, [dynamicColors, keypoints, pointColor, pointVisible, toPx]);

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
