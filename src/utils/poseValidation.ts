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

const ARM_SCORE_MIN = 0.25;
/** Elbow glued to the knee = bar on the shins. iPhone still reads wrist-vs-ankle as “drift”. */
const ELBOW_KNEE_CLOSE = 0.11;
const UPPER_ARM_MIN_LEN = 0.07;
const SHOULDER_ABOVE_ELBOW = 0.04;

export function upperArmPlausible(shoulder: KeyPoint, elbow: KeyPoint): boolean {
  const drop = elbow.y - shoulder.y;
  const len = Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y);
  return drop >= SHOULDER_ABOVE_ELBOW && len >= UPPER_ARM_MIN_LEN;
}

/** True when every visible arm has the “shoulder” sitting on the biceps. */
export function shoulderTrackingBroken(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  const sides: Array<[number, number]> = [
    [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.LEFT_ELBOW],
    [KEYPOINTS.RIGHT_SHOULDER, KEYPOINTS.RIGHT_ELBOW],
  ];
  const visible = sides.filter(([si, ei]) => {
    const s = pose.keypoints[si];
    const e = pose.keypoints[ei];
    return s != null && e != null && s.score >= 0.3 && e.score >= ARM_SCORE_MIN;
  });
  if (visible.length === 0) return false;
  return visible.every(([si, ei]) => !upperArmPlausible(pose.keypoints[si], pose.keypoints[ei]));
}

export function barHeldAtShins(pose: PoseResult): boolean {
  if (!pose?.keypoints?.length) return false;
  const pairs: Array<[number, number]> = [
    [KEYPOINTS.LEFT_ELBOW, KEYPOINTS.LEFT_KNEE],
    [KEYPOINTS.RIGHT_ELBOW, KEYPOINTS.RIGHT_KNEE],
  ];
  return pairs.some(([ei, ki]) => {
    const elbow = pose.keypoints[ei];
    const knee = pose.keypoints[ki];
    if (!elbow || !knee || elbow.score < ARM_SCORE_MIN || knee.score < LATERAL_MIN_SCORE) {
      return false;
    }
    return Math.hypot(elbow.x - knee.x, elbow.y - knee.y) < ELBOW_KNEE_CLOSE;
  });
}
