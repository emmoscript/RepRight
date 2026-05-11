/**
 * Notebook-style biomechanical cues for deadlift — MoveNet lateral chain (no bar detector).
 * Portrait coords: Y increases downward; wrists low on frame → larger Y → higher displacement when bar rises.
 */
import { angleBetween, type Point2D } from '@/utils/angles';
import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

export type DeadliftFormCue =
  | 'SETTING_UP'
  | 'GOOD_SETUP'
  | 'HIPS_TOO_HIGH'
  | 'DEEP_SETUP'
  | 'ASCENT'
  | 'LOCKOUT'
  | 'UNKNOWN';

/** Match lateral pose / wrist proxy thresholds. */
const CHAIN_SCORE_MIN = 0.2;

type SideChain = Readonly<{ shoulder: Point2D; hip: Point2D; knee: Point2D; scoreMin: number }>;

function lateralChainBestSide(pose: PoseResult): SideChain | null {
  const kp = pose.keypoints;
  if (!kp?.length) return null;

  const ls = kp[KEYPOINTS.LEFT_SHOULDER];
  const lh = kp[KEYPOINTS.LEFT_HIP];
  const lk = kp[KEYPOINTS.LEFT_KNEE];
  const rs = kp[KEYPOINTS.RIGHT_SHOULDER];
  const rh = kp[KEYPOINTS.RIGHT_HIP];
  const rk = kp[KEYPOINTS.RIGHT_KNEE];
  if (!ls || !lh || !lk || !rs || !rh || !rk) return null;

  const leftMin = Math.min(ls.score, lh.score, lk.score);
  const rightMin = Math.min(rs.score, rh.score, rk.score);
  const leftUsable = leftMin >= CHAIN_SCORE_MIN;
  const rightUsable = rightMin >= CHAIN_SCORE_MIN;
  if (!leftUsable && !rightUsable) return null;

  const useLeft = !rightUsable || (leftUsable && leftMin >= rightMin);

  if (useLeft) {
    return {
      shoulder: { x: ls.x, y: ls.y },
      hip: { x: lh.x, y: lh.y },
      knee: { x: lk.x, y: lk.y },
      scoreMin: leftMin,
    };
  }
  return {
    shoulder: { x: rs.x, y: rs.y },
    hip: { x: rh.x, y: rh.y },
    knee: { x: rk.x, y: rk.y },
    scoreMin: rightMin,
  };
}

/** Interior hip hinge angle (YOLO notebook: shoulder–hip–knee), degrees. */
export function lateralHipHingeDegrees(pose: PoseResult): number | null {
  const ch = lateralChainBestSide(pose);
  if (!ch || ch.scoreMin < CHAIN_SCORE_MIN) return null;
  return angleBetween(ch.shoulder, ch.hip, ch.knee);
}

/**
 * Cue akin to notebook `f_msg`: uses normalized bar displacement bands (notebook used px thresholds).
 */
export function inferDeadliftFormCue(
  hingeDeg: number | null,
  displacementNorm: number,
  isPullStart: boolean,
): DeadliftFormCue {
  const lowDisp = displacementNorm < 0.06;
  if (hingeDeg == null || !Number.isFinite(hingeDeg)) return 'UNKNOWN';

  if (isPullStart && lowDisp) {
    if (hingeDeg > 100) return 'HIPS_TOO_HIGH';
    if (hingeDeg < 45) return 'DEEP_SETUP';
    return 'GOOD_SETUP';
  }
  if (!lowDisp) {
    if (hingeDeg > 175) return 'LOCKOUT';
    return 'ASCENT';
  }
  return 'SETTING_UP';
}
