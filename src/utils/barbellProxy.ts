import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

/** Lateral framing: allow one-sided wrist readings. */
/** Align with lateral pose thresholds (tocados en cadena inferior). */
const WRIST_SCORE_MIN = 0.2;

export interface BarbellProxy {
  /** Normalized 0–1 in portrait overlay space. */
  x: number;
  y: number;
  compositeScore: number;
  /** Both wrists exceeded score threshold — average of x/y was used. */
  bothVisible: boolean;
}

/**
 * Barbell position proxy — average wrists when both confident; otherwise the single confident wrist.
 * Coordinates align with overlay after `mapPoseToPreviewSpace`.
 */
export function barbellProxyFromWrists(pose: PoseResult): BarbellProxy | null {
  const kp = pose.keypoints;
  if (!kp?.length) return null;
  const lw = kp[KEYPOINTS.LEFT_WRIST];
  const rw = kp[KEYPOINTS.RIGHT_WRIST];
  if (!lw || !rw) return null;

  const lOk = lw.score >= WRIST_SCORE_MIN;
  const rOk = rw.score >= WRIST_SCORE_MIN;

  if (!lOk && !rOk) return null;
  if (!rOk)
    return { x: lw.x, y: lw.y, compositeScore: lw.score, bothVisible: false };
  if (!lOk)
    return { x: rw.x, y: rw.y, compositeScore: rw.score, bothVisible: false };

  return {
    x: (lw.x + rw.x) / 2,
    y: (lw.y + rw.y) / 2,
    compositeScore: (lw.score + rw.score) / 2,
    bothVisible: true,
  };
}
