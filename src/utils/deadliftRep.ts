import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

/** Min score so a hip is considered for vertical rep tracking (shirt / side view — keep permissive). */
const HIP_SCORE_MIN = 0.1;

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
   * “Bottom” gate — nearer early builds that reliably counted reps (camisa / lado / encuadre).
   * Shallower hinge still arms; pair with modest {@link minHipAscentNorm}.
   */
  setupMinY: 0.41,
  /** Lockout: hips high on screen ⇒ small Y; slightly relaxed vs setup so finish registers reliably. */
  lockoutMaxY: 0.468,
  consecutiveSetupFrames: 3,
  consecutiveLockoutFrames: 4,
  /** Enough travel to kill ghosts; low so partial ROM deadlifts still complete. */
  minHipAscentNorm: 0.024,
} as const;
