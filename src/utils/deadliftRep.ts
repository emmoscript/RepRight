import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

/** Min score so a hip is considered for vertical rep tracking (slightly loose for occluded sides). */
const HIP_SCORE_MIN = 0.14;

/**
 * Lateral deadlift: use hips as primary vertical signal (average when both visible).
 */
export function primaryHipY(pose: PoseResult): number | null {
  const kp = pose.keypoints;
  if (!kp || kp.length < 17) return null;
  const lh = kp[KEYPOINTS.LEFT_HIP];
  const rh = kp[KEYPOINTS.RIGHT_HIP];
  if (!lh || !rh) return null;
  if (lh.score < HIP_SCORE_MIN && rh.score < HIP_SCORE_MIN) return null;
  if (rh.score < HIP_SCORE_MIN) return lh.y;
  if (lh.score < HIP_SCORE_MIN) return rh.y;
  return (lh.y + rh.y) / 2;
}

/**
 * Portrait UI: Y increases downward. Setup (hips low) → larger Y. Lockout (hips high) → smaller Y.
 * Count when we reach stable lockout after a stable setup.
 */
export const DEADLIFT_REP_THRESH = {
  /**
   * Hips deeper than this (higher normalized Y — portrait, origin top) qualify setup streak.
   * Slightly forgiving so moderate hinge depth still arms; pair with {@link minHipAscentNorm}.
   */
  setupMinY: 0.49,
  /** Hips clearly high (small Y): stricter than before to trim “ghost” reps from borderline jitter. */
  lockoutMaxY: 0.425,
  consecutiveSetupFrames: 5,
  /** Extra frames at lockout blunt single-frame dips from latency / noisy hips. */
  consecutiveLockoutFrames: 7,
  /**
   * Must rise this much vs deepest hip Y seen while arming setup (same units as keypoint Y).
   * Stops noisy brief “bottom→top” bursts without real travel.
   */
  minHipAscentNorm: 0.05,
} as const;
