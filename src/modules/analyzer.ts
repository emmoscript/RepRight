/**
 * analyzer.ts
 * Biomechanical analysis engine.
 * Consumes a PoseResult + history, emits detected errors per frame.
 *
 * The 5 parameters:
 *  ERR_001 — Lumbar rounding (torso chain angle < 165°)
 *  ERR_002 — Hips too high at initiation (pull_initiation only)
 *  ERR_003 — Bar drift away from body
 *  ERR_004 — Lean-back at lockout (same-side shoulder behind hip + open torso)
 *  ERR_005 — Shoulder behind bar at setup (> 5% frame width)
 */

import { PoseResult, KEYPOINTS, MIN_KEYPOINT_SCORE, type KeyPoint } from './movenet';
import { angleBetween } from '../utils/angles';

export type ErrorId = 'ERR_001' | 'ERR_002' | 'ERR_003' | 'ERR_004' | 'ERR_005';
export type Severity = 'critical' | 'warning' | 'info';
export type Phase =
  | 'setup'
  | 'pull_initiation'
  | 'mid_pull'
  | 'lockout'
  | 'descent'
  | 'unknown';

export interface BiomechanicalError {
  errorId: ErrorId;
  severity: Severity;
  confidence: number;    // 0–1
  frameTimestamp: number;
}

export interface AnalysisResult {
  phase: Phase;
  errors: BiomechanicalError[];
  angles: {
    lumbar: number | null;
    hipExtension: number | null;
    shoulderBarOffset: number | null;
  };
  repDetected: boolean;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Lumbar rounding needs a trustworthy shoulder–hip–knee chain (noisy knees → false ERR_001). */
const LUMBAR_ROUND_MIN_SHOULDER = 0.35;
const LUMBAR_ROUND_MIN_HIP = 0.3;
const LUMBAR_ROUND_MIN_KNEE = 0.25;
/** Open torso (lean-back / neutral lockout) — not rounding. */
const LUMBAR_OPEN_TORSO = 168;
/** Late pull: lean-back prep and lockout geometry confuse 2D lumbar reads. */
const LUMBAR_ROUND_MAX_DEPTH = 0.11;
const LUMBAR_ROUNDING_THRESHOLD = 165;
const HIP_EXTENSION_THRESHOLD = 145; // side-view 2D — soft knee at lockout
/** Torso opens beyond this at lockout with shoulder behind hip → lean-back. */
const LUMBAR_LEANBACK_LOCKOUT = 176;
/** Side view: shoulder x behind hip x (normalized frame width). */
/** Side view: shoulder x behind hip x (normalized frame width). Packed chest is ~0.03–0.05. */
const SHOULDER_BEHIND_HIP_LEANBACK = 0.06;
const SHOULDER_BAR_OFFSET_THRESHOLD = 0.06;
const LUMBAR_LEANBACK_MIN_SHOULDER = 0.28;
const LUMBAR_LEANBACK_MIN_HIP = 0.28;
const LUMBAR_LEANBACK_MIN_KNEE = 0.22;
/** Hinged setup: hip must sit in lower ~45% of observed ROM (not idle standing). */
const SETUP_HIP_ROM_FRAC = 0.45;
const BAR_DRIFT_THRESHOLD = 0.08;

/** Knee often drops below 0.3 during pulls; shoulder/hip stay reliable. */
const CHAIN_KNEE_MIN_SCORE = 0.12;
const PHASE_HIP_MIN_SCORE = 0.15;
const HIP_MOTION_EPS = 0.002;

function bestKeypoint(a: KeyPoint, b: KeyPoint): KeyPoint {
  return a.score >= b.score ? a : b;
}

function chainPoint(
  pose: PoseResult,
  leftIdx: number,
  rightIdx: number,
  minScore: number,
): KeyPoint | null {
  const kp = bestKeypoint(pose.keypoints[leftIdx], pose.keypoints[rightIdx]);
  return kp.score >= minScore ? kp : null;
}

function lumbarAngleForPose(pose: PoseResult): number | null {
  const shoulder = chainPoint(
    pose,
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    MIN_KEYPOINT_SCORE,
  );
  const hip = chainPoint(pose, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP, MIN_KEYPOINT_SCORE);
  const knee = chainPoint(pose, KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE, CHAIN_KNEE_MIN_SCORE);
  if (!shoulder || !hip || !knee) return null;
  return angleBetween(shoulder, hip, knee);
}

function lumbarChainReliableForRounding(pose: PoseResult): boolean {
  const shoulder = bestKeypoint(
    pose.keypoints[KEYPOINTS.LEFT_SHOULDER],
    pose.keypoints[KEYPOINTS.RIGHT_SHOULDER],
  );
  const hip = bestKeypoint(
    pose.keypoints[KEYPOINTS.LEFT_HIP],
    pose.keypoints[KEYPOINTS.RIGHT_HIP],
  );
  const knee = bestKeypoint(
    pose.keypoints[KEYPOINTS.LEFT_KNEE],
    pose.keypoints[KEYPOINTS.RIGHT_KNEE],
  );
  return (
    shoulder.score >= LUMBAR_ROUND_MIN_SHOULDER &&
    hip.score >= LUMBAR_ROUND_MIN_HIP &&
    knee.source !== 'predicted' &&
    knee.score >= LUMBAR_ROUND_MIN_KNEE
  );
}

// ─── Phase Detection ──────────────────────────────────────────────────────────

function hipMotion(history: PoseResult[], pose: PoseResult): { movingUp: boolean; movingDown: boolean } {
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const prevHip = history[history.length - 2]?.keypoints[KEYPOINTS.LEFT_HIP];
  if (hip.score < PHASE_HIP_MIN_SCORE || !prevHip || prevHip.score < PHASE_HIP_MIN_SCORE) {
    return { movingUp: false, movingDown: false };
  }
  const delta = hip.y - prevHip.y;
  return {
    movingUp: delta < -HIP_MOTION_EPS,
    movingDown: delta > HIP_MOTION_EPS,
  };
}

/** Fallback when ROM window is too small (start of set). */
function detectPhaseFromHipRelative(
  hipRelative: number,
  movingUp: boolean,
  movingDown: boolean,
): Phase {
  if (hipRelative < 0.42) return 'setup';
  if (movingUp && hipRelative < 0.62) return 'pull_initiation';
  if (movingUp && hipRelative < 0.82) return 'mid_pull';
  if (hipRelative >= 0.78) return movingDown ? 'descent' : 'lockout';
  if (movingDown) return 'descent';
  return 'unknown';
}

export function detectPhase(pose: PoseResult, history: PoseResult[]): Phase {
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const ankle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];

  if (hip.score < PHASE_HIP_MIN_SCORE || shoulder.score < MIN_KEYPOINT_SCORE) {
    return 'unknown';
  }

  const { movingUp, movingDown } = hipMotion(history, pose);

  const hipSamples = [...history.slice(-14), pose]
    .map((p) => p.keypoints[KEYPOINTS.LEFT_HIP])
    .filter((k) => k.score >= PHASE_HIP_MIN_SCORE)
    .map((k) => k.y);

  if (hipSamples.length >= 3) {
    const bottomY = Math.max(...hipSamples);
    const depthFromBottom = bottomY - hip.y;

    if (depthFromBottom < 0.02) return 'setup';

    if (movingUp) {
      if (depthFromBottom < 0.05) return 'pull_initiation';
      if (depthFromBottom < 0.09) return 'mid_pull';
      return 'lockout';
    }

    if (movingDown && depthFromBottom > 0.03) return 'descent';
    if (depthFromBottom >= 0.09) return 'lockout';
  }

  const bodyHeight = Math.abs(shoulder.y - ankle.y);
  if (bodyHeight < 0.01) return 'unknown';
  const hipRelative = (hip.y - ankle.y) / bodyHeight;
  return detectPhaseFromHipRelative(hipRelative, movingUp, movingDown);
}

// ─── Rep Detection ────────────────────────────────────────────────────────────

export function detectRep(_phase: Phase, _history: PoseResult[]): boolean {
  return false;
}

// ─── Error Detectors ─────────────────────────────────────────────────────────

function isPullPhase(phase: Phase): boolean {
  return phase === 'pull_initiation' || phase === 'mid_pull';
}

function depthFromBottomRom(pose: PoseResult, history: PoseResult[]): number | null {
  const hipSamples = [...history.slice(-14), pose]
    .map((p) => p.keypoints[KEYPOINTS.LEFT_HIP])
    .filter((k) => k.score >= PHASE_HIP_MIN_SCORE)
    .map((k) => k.y);
  if (hipSamples.length < 3) return null;
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  if (hip.score < PHASE_HIP_MIN_SCORE) return null;
  const sorted = [...hipSamples].sort((a, b) => b - a);
  /** Ignore single-frame depth spikes (pose dropout / rearm jitter). */
  const bottomY =
    sorted.length >= 2 && sorted[0] - sorted[1] > 0.06 ? sorted[1] : sorted[0];
  return bottomY - hip.y;
}

/** First ~10% of ROM off the floor — hips-first faults happen here. */
function isEarlyPullPhase(phase: Phase, depthFromBottom: number | null): boolean {
  if (phase === 'pull_initiation') return true;
  return phase === 'mid_pull' && depthFromBottom != null && depthFromBottom < 0.12;
}

/** Noisy pull starts often drop below 0.3 — still need velocity for ERR_002. */
const VELOCITY_TRACK_MIN_SCORE = 0.08;
const HIP_SHOOT_VELOCITY_RATIO = 1.25;

function chainPointLoose(
  pose: PoseResult,
  leftIdx: number,
  rightIdx: number,
): KeyPoint | null {
  return chainPoint(pose, leftIdx, rightIdx, VELOCITY_TRACK_MIN_SCORE);
}

function hipShoulderRise(
  pose: PoseResult,
  history: PoseResult[],
): { hipRise: number; shoulderRise: number } | null {
  if (history.length < 2) return null;
  const prev = history[history.length - 1];
  const hipNow = chainPointLoose(pose, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP);
  const hipPrev = chainPointLoose(prev, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP);
  const shNow = chainPointLoose(pose, KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER);
  const shPrev = chainPointLoose(prev, KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER);
  if (!hipNow || !hipPrev || !shNow || !shPrev) return null;
  return {
    hipRise: hipPrev.y - hipNow.y,
    shoulderRise: shPrev.y - shNow.y,
  };
}

function shoulderHipVerticalGap(pose: PoseResult): number | null {
  const shoulder = chainPoint(
    pose,
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    MIN_KEYPOINT_SCORE,
  );
  const hip = chainPoint(pose, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP, MIN_KEYPOINT_SCORE);
  if (!shoulder || !hip) return null;
  return shoulder.y - hip.y;
}

function hipsShootingFirstSignal(pose: PoseResult, history: PoseResult[], phase: Phase): boolean {
  const depth = depthFromBottomRom(pose, history);
  if (!isEarlyPullPhase(phase, depth)) return false;

  const rise = hipShoulderRise(pose, history);
  if (!rise) return false;

  const { hipRise, shoulderRise } = rise;
  if (hipRise < 0.004) return false;
  /** Shoulder collapsing toward hip reads as rounding (ERR_001), not hips shooting. */
  if (shoulderRise < -0.004) return false;
  if (hipRise > Math.max(shoulderRise, 0) * HIP_SHOOT_VELOCITY_RATIO + 0.001) {
    return true;
  }
  /** Hips clearly ahead even when both move (Block 3 hips-first drill). */
  return hipRise > shoulderRise + 0.003;
}

function checkLumbarRounding(
  pose: PoseResult,
  phase: Phase,
  history: PoseResult[],
): BiomechanicalError | null {
  if (!isPullPhase(phase)) return null;
  if (hipsShootingFirstSignal(pose, history, phase)) return null;
  if (!lumbarChainReliableForRounding(pose)) return null;

  const depth = depthFromBottomRom(pose, history);
  /** Hinged bottom position reads as flexion in 2D — wait until the bar leaves the floor. */
  if (depth == null || depth < 0.04 || depth > LUMBAR_ROUND_MAX_DEPTH) return null;

  const angle = lumbarAngleForPose(pose);
  if (angle == null || angle >= LUMBAR_OPEN_TORSO) return null;

  if (angle < LUMBAR_ROUNDING_THRESHOLD) {
    const rise = hipShoulderRise(pose, history);
    if (
      rise &&
      isEarlyPullPhase(phase, depth) &&
      rise.hipRise >= 0.004 &&
      rise.shoulderRise >= -0.004 &&
      rise.hipRise > rise.shoulderRise + 0.003
    ) {
      return null;
    }
    return {
      errorId: 'ERR_001',
      severity: 'critical',
      confidence: Math.min(1, (LUMBAR_ROUNDING_THRESHOLD - angle) / 35),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

function checkHipsTooHigh(
  pose: PoseResult,
  phase: Phase,
  history: PoseResult[],
): BiomechanicalError | null {
  const depth = depthFromBottomRom(pose, history);
  if (!isEarlyPullPhase(phase, depth)) return null;

  const diff = shoulderHipVerticalGap(pose);
  const velocityHipsFirst = hipsShootingFirstSignal(pose, history, phase);
  const geometryHipsHigh =
    diff != null && diff < 0.05 && velocityHipsFirst;

  if (!velocityHipsFirst && !geometryHipsHigh) return null;

  return {
    errorId: 'ERR_002',
    severity: 'critical',
    confidence: velocityHipsFirst
      ? Math.min(1, Math.abs((diff ?? 0.05) - 0.05) / 0.1 + 0.5)
      : Math.min(1, Math.abs((diff ?? 0.05) - 0.05) / 0.1),
    frameTimestamp: pose.timestamp,
  };
}

/** Hips rise noticeably faster than shoulders — classic hips-shoot-first fault. */
function checkHipsShootingFirst(
  pose: PoseResult,
  history: PoseResult[],
  phase: Phase,
): BiomechanicalError | null {
  if (!hipsShootingFirstSignal(pose, history, phase)) return null;

  return {
    errorId: 'ERR_002',
    severity: 'critical',
    confidence: 0.85,
    frameTimestamp: pose.timestamp,
  };
}

function checkBarDrift(
  pose: PoseResult,
  phase: Phase,
  _history: PoseResult[],
): BiomechanicalError | null {
  // Bar path is only meaningful mid-pull; initiation wrist noise causes false positives.
  if (phase !== 'mid_pull') return null;

  const wrist = chainPointLoose(pose, KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST);
  const ankle = chainPointLoose(pose, KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE);
  const hip = chainPointLoose(pose, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP);
  if (!wrist) return null;

  const ankleOffset =
    ankle != null && ankle.source !== 'predicted' ? Math.abs(wrist.x - ankle.x) : 0;
  const hipOffset = hip != null ? Math.abs(wrist.x - hip.x) : 0;
  const horizontalOffset = Math.max(ankleOffset, hipOffset);

  if (horizontalOffset > BAR_DRIFT_THRESHOLD) {
    return {
      errorId: 'ERR_003',
      severity: 'warning',
      confidence: Math.min(1, (horizontalOffset - BAR_DRIFT_THRESHOLD) / 0.1),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

function leanbackChainReliableForHyperextension(pose: PoseResult): boolean {
  return lockoutLeanbackSide(pose) != null;
}

/** Same-side shoulder–hip–knee. Mixing far/near joints inflates “shoulder behind hip”. */
function lockoutLeanbackSide(
  pose: PoseResult,
): { shoulder: KeyPoint; hip: KeyPoint; knee: KeyPoint } | null {
  const kp = pose.keypoints;
  const left = {
    shoulder: kp[KEYPOINTS.LEFT_SHOULDER],
    hip: kp[KEYPOINTS.LEFT_HIP],
    knee: kp[KEYPOINTS.LEFT_KNEE],
  };
  const right = {
    shoulder: kp[KEYPOINTS.RIGHT_SHOULDER],
    hip: kp[KEYPOINTS.RIGHT_HIP],
    knee: kp[KEYPOINTS.RIGHT_KNEE],
  };
  const minOf = (s: typeof left) => Math.min(s.shoulder.score, s.hip.score, s.knee.score);
  const ok = (s: typeof left) =>
    s.knee.source !== 'predicted' &&
    s.shoulder.score >= LUMBAR_LEANBACK_MIN_SHOULDER &&
    s.hip.score >= LUMBAR_LEANBACK_MIN_HIP &&
    s.knee.score >= LUMBAR_LEANBACK_MIN_KNEE;
  const leftOk = ok(left);
  const rightOk = ok(right);
  if (leftOk && (!rightOk || minOf(left) >= minOf(right))) return left;
  if (rightOk) return right;
  return null;
}

function checkHyperextension(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'lockout') return null;

  const chain = lockoutLeanbackSide(pose);
  if (!chain) return null;

  const { shoulder, hip, knee } = chain;
  const shoulderBehindHip = shoulder.x - hip.x;
  if (shoulderBehindHip < SHOULDER_BEHIND_HIP_LEANBACK) return null;

  const lumbar = angleBetween(shoulder, hip, knee);
  // Packed chest / retracted scapulae open the torso a little. Layback opens it further.
  if (lumbar < LUMBAR_LEANBACK_LOCKOUT) return null;

  return {
    errorId: 'ERR_004',
    severity: 'warning',
    confidence: Math.min(
      1,
      (shoulderBehindHip - SHOULDER_BEHIND_HIP_LEANBACK) / 0.06 +
        Math.max(0, (lumbar - LUMBAR_LEANBACK_LOCKOUT) / 12),
    ),
    frameTimestamp: pose.timestamp,
  };
}

function isHingedSetupPose(pose: PoseResult, history: PoseResult[]): boolean {
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const samples = [...history.slice(-14), pose]
    .map((p) => p.keypoints[KEYPOINTS.LEFT_HIP])
    .filter((k) => k.score >= PHASE_HIP_MIN_SCORE)
    .map((k) => k.y);
  if (samples.length < 3) return false;
  const standingY = Math.min(...samples);
  const bottomY = Math.max(...samples);
  const rom = bottomY - standingY;
  if (rom < 0.04) return false;
  return hip.y >= standingY + rom * SETUP_HIP_ROM_FRAC;
}

function checkShoulderBarAlignment(
  pose: PoseResult,
  phase: Phase,
  history: PoseResult[],
): BiomechanicalError | null {
  if (phase !== 'setup') return null;
  if (!isHingedSetupPose(pose, history)) return null;

  const shoulder = chainPoint(
    pose,
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    MIN_KEYPOINT_SCORE,
  );
  const wrist = chainPoint(pose, KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST, MIN_KEYPOINT_SCORE);
  if (!shoulder || !wrist) return null;

  const offset = shoulder.x - wrist.x;

  if (offset > SHOULDER_BAR_OFFSET_THRESHOLD) {
    return {
      errorId: 'ERR_005',
      severity: 'warning',
      confidence: Math.min(1, (offset - SHOULDER_BAR_OFFSET_THRESHOLD) / 0.1),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

/** Lumbar still neutral — hips-first start is ERR_002, not rounding. */
const LUMBAR_NEUTRAL_FOR_HIPS_HIGH = LUMBAR_ROUNDING_THRESHOLD - 8;

function resolveHipSwayErrors(
  errors: BiomechanicalError[],
  lumbar: number | null,
  pose: PoseResult,
): BiomechanicalError[] {
  const has001 = errors.some((e) => e.errorId === 'ERR_001');
  const has002 = errors.some((e) => e.errorId === 'ERR_002');

  if (has002) {
    return errors.filter((e) => e.errorId !== 'ERR_001');
  }

  if (!has001) return errors;

  const lumbarNeutral = lumbar != null && lumbar >= LUMBAR_NEUTRAL_FOR_HIPS_HIGH;
  if (lumbarNeutral) {
    const rest = errors.filter((e) => e.errorId !== 'ERR_001' && e.errorId !== 'ERR_005');
    rest.push({
      errorId: 'ERR_002',
      severity: 'critical',
      confidence: 0.75,
      frameTimestamp: pose.timestamp,
    });
    return rest;
  }

  return errors.filter((e) => e.errorId !== 'ERR_002' && e.errorId !== 'ERR_005');
}

/** Forward bar path changes the 2D torso read — prefer drift over rounding. */
function resolveBarDriftErrors(errors: BiomechanicalError[], phase: Phase): BiomechanicalError[] {
  const has003 = errors.some((e) => e.errorId === 'ERR_003');
  if (!has003 || !isPullPhase(phase)) return errors;
  return errors.filter((e) => e.errorId !== 'ERR_001');
}

/** Lean-back (ERR_004) and rounding (ERR_001) share a torso chain — never both at once. */
function resolveSwayHyperextensionConflict(
  errors: BiomechanicalError[],
  lumbar: number | null,
): BiomechanicalError[] {
  const has004 = errors.some((e) => e.errorId === 'ERR_004');
  if (has004) {
    return errors.filter((e) => e.errorId !== 'ERR_001' && e.errorId !== 'ERR_002');
  }
  if (lumbar != null && lumbar >= LUMBAR_OPEN_TORSO) {
    return errors.filter((e) => e.errorId !== 'ERR_001');
  }
  return errors;
}

/** At lockout, bar-drift reads are unreliable — prefer hyperextension. */
function resolveLockoutErrors(errors: BiomechanicalError[], phase: Phase): BiomechanicalError[] {
  if (phase !== 'lockout') return errors;
  const withoutDrift = errors.filter((e) => e.errorId !== 'ERR_003');
  const has004 = withoutDrift.some((e) => e.errorId === 'ERR_004');
  if (!has004) return withoutDrift;
  return withoutDrift.filter(
    (e) => e.errorId === 'ERR_004' || e.errorId === 'ERR_005',
  );
}

/** Skip setup-only warnings while the hip is actively ascending (pull in progress). */
function suppressPullPhaseNoise(errors: BiomechanicalError[], phase: Phase): BiomechanicalError[] {
  if (phase === 'setup' || phase === 'lockout' || phase === 'descent') {
    return errors.filter((e) => e.errorId !== 'ERR_002');
  }
  return errors;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function analyzePose(pose: PoseResult, history: PoseResult[]): AnalysisResult {
  const phase = detectPhase(pose, history);

  const shoulder = chainPoint(
    pose,
    KEYPOINTS.LEFT_SHOULDER,
    KEYPOINTS.RIGHT_SHOULDER,
    MIN_KEYPOINT_SCORE,
  );
  const hip = chainPoint(pose, KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP, MIN_KEYPOINT_SCORE);
  const knee = chainPoint(pose, KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE, CHAIN_KNEE_MIN_SCORE);
  const ankle = chainPoint(pose, KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE, CHAIN_KNEE_MIN_SCORE);
  const wrist = chainPoint(pose, KEYPOINTS.LEFT_WRIST, KEYPOINTS.RIGHT_WRIST, MIN_KEYPOINT_SCORE);

  const lumbar = shoulder && hip && knee ? angleBetween(shoulder, hip, knee) : lumbarAngleForPose(pose);

  const hipExtension = hip && knee && ankle ? angleBetween(hip, knee, ankle) : null;

  const shoulderBarOffset = shoulder && wrist ? shoulder.x - wrist.x : null;

  const rawErrors = [
    checkLumbarRounding(pose, phase, history),
    checkHipsTooHigh(pose, phase, history),
    checkHipsShootingFirst(pose, history, phase),
    checkBarDrift(pose, phase, history),
    checkHyperextension(pose, phase),
    checkShoulderBarAlignment(pose, phase, history),
  ].filter((e): e is BiomechanicalError => e !== null);

  const errors = resolveLockoutErrors(
    resolveSwayHyperextensionConflict(
      suppressPullPhaseNoise(
        resolveBarDriftErrors(resolveHipSwayErrors(rawErrors, lumbar, pose), phase),
        phase,
      ),
      lumbar,
    ),
    phase,
  );

  return {
    phase,
    errors,
    angles: { lumbar, hipExtension, shoulderBarOffset },
    repDetected: detectRep(phase, history),
  };
}
