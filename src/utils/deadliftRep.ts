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
 * Thresholds are **relative to a standing hip baseline** captured at session start.
 */
export const DEADLIFT_REP_THRESH = {
  /** Frames at lift start used to estimate standing hip height. */
  baselineFrameCount: 12,
  /** Hips must drop this far below standing (norm Y) to arm the bottom of a rep. */
  setupDropBelowStanding: 0.055,
  /**
   * Lockout: hips at or above standing (y <= stand + slack).
   * Side-view keypoints rarely exceed a large rise above baseline — ROM is the primary signal.
   */
  lockoutStandingSlack: 0.014,
  /** After lockout, hips must descend near standing before the next rep can arm. */
  returnToStandingMargin: 0.012,
  consecutiveSetupFrames: 3,
  consecutiveLockoutFrames: 3,
  consecutiveReturnFrames: 2,
  /** Min ascent from armed bottom to lockout (full rep ROM — primary count gate). */
  repRomCompleteNorm: 0.062,
  /** Ignore back-to-back counts within this window. */
  minMsBetweenReps: 1800,
  /** Min time from bottom-arm to lockout count (blocks flicker double-counts). */
  minMsFromArmToCount: 700,
  /** EMA alpha for hip Y used by rep FSM (raw keypoints flicker in side view). */
  hipSmoothAlpha: 0.32,
} as const;

/** Tallest posture during calibration = minimum Y (hips highest on screen). */
export function standingHipYFromBaseline(samples: number[]): number {
  if (samples.length === 0) return 0;
  return Math.min(...samples);
}

/** Exponential moving average — dampens single-frame hip spikes. */
export function smoothHipY(prev: number | null, sample: number): number {
  if (prev == null) return sample;
  const a = DEADLIFT_REP_THRESH.hipSmoothAlpha;
  return prev + a * (sample - prev);
}
