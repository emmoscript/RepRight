import { KEYPOINTS, type KeyPoint, type PoseResult } from '@/modules/movenet';

/**
 * Lateral deadlift: hips + knees (one side is enough) to start a set.
 * Ankles are not required — a plate-elevated bar (~9" / 22 cm) is a shallower
 * hinge than a floor squat, and side-view ankles often stay below score cutoff.
 */
const LATERAL_MIN_SCORE = 0.2;

const LOWER_CHAIN_PAIRS: [number, number][] = [
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE],
];

function observedScore(k: KeyPoint | undefined): number {
  if (!k || k.source === 'predicted') return 0;
  return k.score;
}

export function isPoseValid(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  return LOWER_CHAIN_PAIRS.every(([l, r]) => {
    const left = pose.keypoints[l];
    const right = pose.keypoints[r];
    if (!left || !right) return false;
    return observedScore(left) >= LATERAL_MIN_SCORE || observedScore(right) >= LATERAL_MIN_SCORE;
  });
}

/**
 * Active / pose_lost: hips only. Knees vanish behind plates; the rep FSM
 * already uses hip Y. Search still requires real knees via {@link isPoseValid}.
 */
const LIFT_TRACK_MIN_SCORE = 0.18;

export function isPoseStableForLiftTracking(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  const lh = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const rh = pose.keypoints[KEYPOINTS.RIGHT_HIP];
  if (!lh || !rh) return false;
  return observedScore(lh) >= LIFT_TRACK_MIN_SCORE || observedScore(rh) >= LIFT_TRACK_MIN_SCORE;
}
