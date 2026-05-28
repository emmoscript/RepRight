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
  /** Extra slack when deciding if lockout height was reached (side view + smoothing). */
  lockoutCountSlack: 0.028,
  /** After lockout: hips must clear lockout zone (y rises past this). **Below** bottomGate. */
  returnToStandingMargin: 0.030,
  /** Ignore return/re-arm samples above this (walk-to-camera glitches). */
  returnGlitchMaxAboveStanding: 0.12,
  /** Do not re-arm lockout below a depth above this (same glitches). */
  lockoutRearmMaxAboveStanding: 0.16,
  /** Abandon need_lockout only when stuck at bottom this long (slow reps get 12s+). */
  maxLockoutWaitMs: 12000,
  /** Reject lockout count if bottom was armed longer ago than this (fast reps). */
  maxArmAgeForCount: 12000,
  /** Extended arm-age ceiling once meaningful ascent is underway (slow reps). */
  maxArmAgeForCountSlowMs: 22000,
  /** Above this ascent fraction, use the slow-rep arm-age ceiling. */
  slowRepAscentProgressFrac: 0.35,
  /** Min hip keypoint confidence to allow a rep COUNT. */
  minHipScoreForCount: 0.22,
  /** Armed bottom must clear bottomGate by at least this (blocks shallow false-arms). */
  minBottomClearanceBeyondGate: 0.026,
  /** While waiting for lockout, re-arm if hips drop this much below current armed bottom. */
  lockoutRearmMinDrop: 0.028,
  consecutiveSetupFrames: 3,
  consecutiveLockoutFrames: 2,
  /** With clear ROM, one valid lockout frame is enough (normal tempo + valid=false flicker). */
  lockoutStrongRomFrac: 1.1,
  /** One frame at return gate — fast touch-and-go rarely holds 2 frames mid-descent. */
  consecutiveReturnFrames: 1,
  /** Min ascent from armed bottom to lockout (full rep ROM — primary count gate). */
  repRomCompleteNorm: 0.062,
  /** Ignore back-to-back counts within this window. */
  minMsBetweenReps: 700,
  /** Min time from bottom-arm to lockout count (blocks flicker double-counts). */
  minMsFromArmToCount: 550,
  /** After a COUNT, block shallow setup-arms for this window (walk-off / rack false reps). */
  postCountShallowArmBlockMs: 1200,
  /** Min frames with hips below bottom gate while armed (blocks walk-to-camera false reps). */
  minDeepHoldFrames: 3,
  /** stale_reset only when peak ascent is below this fraction of full ROM. */
  staleResetMaxAscentFrac: 0.22,
  /** Do not re-arm lockout when hips are above this offset from lockout line. */
  lockoutRearmUpperRomSlack: 0.038,
  /** During post-count window, armed depth must reach at least bottomGate + this. */
  postCountMinArmDepthBeyondGate: 0.040,
  /** EMA alpha for hip Y used by rep FSM (raw keypoints flicker in side view). */
  hipSmoothAlpha: 0.32,
} as const;

/** Median hip Y — stable standing estimate (min skews low if athlete hinges during countdown). */
export function medianHipY(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0]!;
}

/** Standing reference from calibration window (median, not min). */
export function standingHipYFromBaseline(samples: number[]): number {
  return medianHipY(samples);
}

/** Exponential moving average — dampens single-frame hip spikes. */
export function smoothHipY(prev: number | null, sample: number): number {
  if (prev == null) return sample;
  const a = DEADLIFT_REP_THRESH.hipSmoothAlpha;
  return prev + a * (sample - prev);
}

export type RepBottomArmReject = 'min_deep' | 'post_count_shallow';

/** Shared gate for arming the bottom of a rep (setup or touch-and-go return). */
export function repBottomArmGate(
  armedCandidate: number,
  bottomGate: number,
  lastCountAtMs: number,
): { ok: true; minDeep: number } | { ok: false; reason: RepBottomArmReject; minDeep: number } {
  const minDeep = bottomGate + DEADLIFT_REP_THRESH.minBottomClearanceBeyondGate;
  const sinceCount = Date.now() - lastCountAtMs;
  const postCountShallow =
    sinceCount < DEADLIFT_REP_THRESH.postCountShallowArmBlockMs &&
    armedCandidate < bottomGate + DEADLIFT_REP_THRESH.postCountMinArmDepthBeyondGate;
  if (armedCandidate < minDeep) return { ok: false, reason: 'min_deep', minDeep };
  if (postCountShallow) return { ok: false, reason: 'post_count_shallow', minDeep };
  return { ok: true, minDeep };
}

/** Hips trustworthy enough to increment rep counter (blocks proximity glitches). */
export function hipsReliableForRepCount(pose: PoseResult): boolean {
  const kp = pose.keypoints;
  if (!kp || kp.length < 17) return false;
  const lh = kp[KEYPOINTS.LEFT_HIP];
  const rh = kp[KEYPOINTS.RIGHT_HIP];
  if (!lh || !rh) return false;
  const min = DEADLIFT_REP_THRESH.minHipScoreForCount;
  if (lh.score >= min && rh.score >= min) return true;
  return lh.score >= 0.35 || rh.score >= 0.35;
}
