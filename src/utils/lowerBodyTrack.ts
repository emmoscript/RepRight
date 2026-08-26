import { KEYPOINTS, type KeyPoint, type PoseResult } from '@/modules/movenet';

export const LOWER_BODY_TRACK = {
  observeMin: 0.5,
  holdRawFloor: 0.3,
  jitterMax: 0.03,
  maxHoldMs: 700,
  predictedScore: 0.22,
} as const;

const TRACKED = [
  KEYPOINTS.LEFT_KNEE,
  KEYPOINTS.RIGHT_KNEE,
  KEYPOINTS.LEFT_ANKLE,
  KEYPOINTS.RIGHT_ANKLE,
] as const;

type Anchor = { x: number; y: number; lastObservedAt: number };

export type LowerBodyTrackState = {
  anchors: Partial<Record<number, Anchor>>;
};

export function createLowerBodyTrackState(): LowerBodyTrackState {
  return { anchors: {} };
}

function isKnee(idx: number): boolean {
  return idx === KEYPOINTS.LEFT_KNEE || idx === KEYPOINTS.RIGHT_KNEE;
}

function observed(raw: KeyPoint): KeyPoint {
  return { ...raw, source: 'observed' };
}

function predicted(x: number, y: number): KeyPoint {
  return { x, y, score: LOWER_BODY_TRACK.predictedScore, source: 'predicted' };
}

function stabilizeOne(
  idx: number,
  raw: KeyPoint,
  anchor: Anchor | undefined,
  nowMs: number,
): { kp: KeyPoint; anchor?: Anchor } {
  const { observeMin, holdRawFloor, jitterMax, maxHoldMs } = LOWER_BODY_TRACK;

  if (raw.score >= observeMin) {
    return {
      kp: observed(raw),
      anchor: { x: raw.x, y: raw.y, lastObservedAt: nowMs },
    };
  }

  if (!anchor) {
    if (raw.score >= holdRawFloor) {
      return {
        kp: { ...raw },
        anchor: { x: raw.x, y: raw.y, lastObservedAt: nowMs },
      };
    }
    return { kp: { ...raw } };
  }

  if (nowMs - anchor.lastObservedAt > maxHoldMs) {
    return { kp: { ...raw }, anchor };
  }

  if (isKnee(idx)) {
    const dx = Math.abs(raw.x - anchor.x);
    if (raw.score >= holdRawFloor && dx < jitterMax) {
      return {
        kp: observed(raw),
        anchor: { x: raw.x, y: raw.y, lastObservedAt: nowMs },
      };
    }
    const y = raw.score >= holdRawFloor ? raw.y : anchor.y;
    return { kp: predicted(anchor.x, y), anchor };
  }

  const dist = Math.hypot(raw.x - anchor.x, raw.y - anchor.y);
  if (raw.score >= holdRawFloor && dist < jitterMax) {
    return {
      kp: observed(raw),
      anchor: { x: raw.x, y: raw.y, lastObservedAt: nowMs },
    };
  }
  return { kp: predicted(anchor.x, anchor.y), anchor };
}

export function stabilizeLowerBodyPose(
  pose: PoseResult,
  state: LowerBodyTrackState,
  nowMs: number,
): { pose: PoseResult; state: LowerBodyTrackState } {
  const anchors: LowerBodyTrackState['anchors'] = { ...state.anchors };
  const keypoints = pose.keypoints.map((k) => ({ ...k }));

  for (const idx of TRACKED) {
    const raw = pose.keypoints[idx];
    if (!raw) continue;
    const next = stabilizeOne(idx, raw, anchors[idx], nowMs);
    keypoints[idx] = next.kp;
    if (next.anchor) anchors[idx] = next.anchor;
  }

  return {
    pose: { ...pose, keypoints },
    state: { anchors },
  };
}
