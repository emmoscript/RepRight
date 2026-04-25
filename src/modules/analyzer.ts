/**
 * analyzer.ts
 * Biomechanical analysis engine.
 * Consumes a PoseResult + history, emits detected errors per frame.
 *
 * The 5 parameters:
 *  ERR_001 — Lumbar rounding (angle < 150°)
 *  ERR_002 — Hips too high at initiation
 *  ERR_003 — Bar drift away from body
 *  ERR_004 — Hyperextension at lockout (angle < 160°)
 *  ERR_005 — Shoulder behind bar at setup (> 5% frame width)
 */

import { PoseResult, KEYPOINTS, MIN_KEYPOINT_SCORE } from './movenet';
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

const LUMBAR_ROUNDING_THRESHOLD = 150;   // degrees — below = rounding
const HIP_EXTENSION_THRESHOLD = 160;     // degrees — below = hyperextension
const SHOULDER_BAR_OFFSET_THRESHOLD = 0.05; // normalized frame width
const BAR_DRIFT_THRESHOLD = 0.08;        // normalized distance from ankle

// ─── Phase Detection ──────────────────────────────────────────────────────────

export function detectPhase(pose: PoseResult, history: PoseResult[]): Phase {
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const ankle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];

  if (hip.score < MIN_KEYPOINT_SCORE || shoulder.score < MIN_KEYPOINT_SCORE) {
    return 'unknown';
  }

  const bodyHeight = Math.abs(shoulder.y - ankle.y);
  if (bodyHeight < 0.01) return 'unknown';

  const hipRelative = (hip.y - ankle.y) / bodyHeight;

  const prevHip = history[history.length - 3]?.keypoints[KEYPOINTS.LEFT_HIP];
  const movingUp = prevHip ? hip.y < prevHip.y : false;
  const movingDown = prevHip ? hip.y > prevHip.y : false;

  if (hipRelative < 0.35) return 'setup';
  if (hipRelative < 0.55 && movingUp) return 'pull_initiation';
  if (hipRelative < 0.75 && movingUp) return 'mid_pull';
  if (hipRelative >= 0.75) return 'lockout';
  if (movingDown) return 'descent';

  return 'unknown';
}

// ─── Rep Detection ────────────────────────────────────────────────────────────

export function detectRep(phase: Phase, history: PoseResult[]): boolean {
  // A rep completes when we transition from lockout → descent
  // Simple heuristic: check if last 5 frames were lockout and current is descent
  // TODO: Refine with phase history tracking
  return false;
}

// ─── Error Detectors ─────────────────────────────────────────────────────────

function checkLumbarRounding(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'pull_initiation' && phase !== 'mid_pull') return null;

  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const knee = pose.keypoints[KEYPOINTS.LEFT_KNEE];

  if ([shoulder, hip, knee].some((kp) => kp.score < MIN_KEYPOINT_SCORE)) return null;

  const angle = angleBetween(shoulder, hip, knee);

  if (angle < LUMBAR_ROUNDING_THRESHOLD) {
    return {
      errorId: 'ERR_001',
      severity: 'critical',
      confidence: Math.min(1, (LUMBAR_ROUNDING_THRESHOLD - angle) / 30),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

function checkHipsTooHigh(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'setup' && phase !== 'pull_initiation') return null;

  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];

  if ([shoulder, hip].some((kp) => kp.score < MIN_KEYPOINT_SCORE)) return null;

  // In image coords: lower y = higher on screen
  // Hips too high = hip.y significantly less than shoulder.y
  const diff = shoulder.y - hip.y; // positive if shoulder is lower than hip

  if (diff < 0.05) {
    return {
      errorId: 'ERR_002',
      severity: 'critical',
      confidence: Math.min(1, Math.abs(diff - 0.05) / 0.1),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

function checkBarDrift(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'mid_pull') return null;

  const wrist = pose.keypoints[KEYPOINTS.LEFT_WRIST];
  const ankle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];

  if ([wrist, ankle].some((kp) => kp.score < MIN_KEYPOINT_SCORE)) return null;

  const horizontalOffset = Math.abs(wrist.x - ankle.x);

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

function checkHyperextension(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'lockout') return null;

  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const knee = pose.keypoints[KEYPOINTS.LEFT_KNEE];
  const ankle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];

  if ([hip, knee, ankle].some((kp) => kp.score < MIN_KEYPOINT_SCORE)) return null;

  const angle = angleBetween(hip, knee, ankle);

  if (angle < HIP_EXTENSION_THRESHOLD) {
    return {
      errorId: 'ERR_004',
      severity: 'warning',
      confidence: Math.min(1, (HIP_EXTENSION_THRESHOLD - angle) / 20),
      frameTimestamp: pose.timestamp,
    };
  }
  return null;
}

function checkShoulderBarAlignment(pose: PoseResult, phase: Phase): BiomechanicalError | null {
  if (phase !== 'setup') return null;

  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const wrist = pose.keypoints[KEYPOINTS.LEFT_WRIST];

  if ([shoulder, wrist].some((kp) => kp.score < MIN_KEYPOINT_SCORE)) return null;

  // Shoulder behind bar = shoulder.x > wrist.x (in lateral view, bar approximated by wrist)
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

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function analyzePose(pose: PoseResult, history: PoseResult[]): AnalysisResult {
  const phase = detectPhase(pose, history);

  const shoulder = pose.keypoints[KEYPOINTS.LEFT_SHOULDER];
  const hip = pose.keypoints[KEYPOINTS.LEFT_HIP];
  const knee = pose.keypoints[KEYPOINTS.LEFT_KNEE];
  const ankle = pose.keypoints[KEYPOINTS.LEFT_ANKLE];
  const wrist = pose.keypoints[KEYPOINTS.LEFT_WRIST];

  const lumbar =
    [shoulder, hip, knee].every((kp) => kp.score >= MIN_KEYPOINT_SCORE)
      ? angleBetween(shoulder, hip, knee)
      : null;

  const hipExtension =
    [hip, knee, ankle].every((kp) => kp.score >= MIN_KEYPOINT_SCORE)
      ? angleBetween(hip, knee, ankle)
      : null;

  const shoulderBarOffset =
    [shoulder, wrist].every((kp) => kp.score >= MIN_KEYPOINT_SCORE)
      ? shoulder.x - wrist.x
      : null;

  const rawErrors = [
    checkLumbarRounding(pose, phase),
    checkHipsTooHigh(pose, phase),
    checkBarDrift(pose, phase),
    checkHyperextension(pose, phase),
    checkShoulderBarAlignment(pose, phase),
  ].filter((e): e is BiomechanicalError => e !== null);

  return {
    phase,
    errors: rawErrors,
    angles: { lumbar, hipExtension, shoulderBarOffset },
    repDetected: detectRep(phase, history),
  };
}
