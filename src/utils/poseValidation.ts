import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

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

export function isPoseValid(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  return LOWER_CHAIN_PAIRS.every(([l, r]) => {
    const left = pose.keypoints[l];
    const right = pose.keypoints[r];
    if (!left || !right) return false;
    return left.score >= LATERAL_MIN_SCORE || right.score >= LATERAL_MIN_SCORE;
  });
}

/**
 * During deadlift tracking, ankles often drop/confuse (side view + knee flex) and trigger pose_lost loops.
 * Hips+knees (one visible side enough) are enough to keep counting reps.
 */
const LIFT_TRACK_MIN_SCORE = 0.18;

export function isPoseStableForLiftTracking(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  const kp = pose.keypoints;
  const lh = kp[KEYPOINTS.LEFT_HIP];
  const rh = kp[KEYPOINTS.RIGHT_HIP];
  const lk = kp[KEYPOINTS.LEFT_KNEE];
  const rk = kp[KEYPOINTS.RIGHT_KNEE];
  if (!lh || !rh || !lk || !rk) return false;
  const hipOk = lh.score >= LIFT_TRACK_MIN_SCORE || rh.score >= LIFT_TRACK_MIN_SCORE;
  const kneeOk = lk.score >= LIFT_TRACK_MIN_SCORE || rk.score >= LIFT_TRACK_MIN_SCORE;
  return hipOk && kneeOk;
}
