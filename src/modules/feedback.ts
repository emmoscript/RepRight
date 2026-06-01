/**
 * feedback.ts
 * Generates real-time visual and audio feedback from AnalysisResult.
 *
 * Throttling rules:
 *  - Audio: max 1 cue per 2 seconds
 *  - Visual: stays for duration of error
 *  - Trigger only if error persists for ≥ 3 consecutive frames (enforced by caller)
 */

import i18n from '@/i18n';

import { AnalysisResult, ErrorId, type BiomechanicalError } from './analyzer';
import { colors } from '../theme/colors';

export interface FeedbackOutput {
  /** Highest-priority error this frame (same ordering as banner / audio). */
  topError: BiomechanicalError | null;
  activeBanner: {
    errorId: string;
    message: string;
    /** Solid banner background (live-session doc). */
    backgroundColor: string;
    /** Primary text on banner (live-session doc). */
    textColor: string;
    severity: 'critical' | 'warning';
  } | null;
  keypointColors: Record<number, string>;  // keypoint index → hex
  triggerHaptic: boolean;
  audioMessage: string | null;
}

const ERROR_SEVERITY: Record<ErrorId, 'critical' | 'warning'> = {
  ERR_001: 'critical',
  ERR_002: 'critical',
  ERR_003: 'warning',
  ERR_004: 'warning',
  ERR_005: 'warning',
};

/** Live-session doc: critical = red bg + white text; warning = amber + dark text. */
const BANNER_CRITICAL_BG = colors.accent_red;
const BANNER_CRITICAL_TXT = '#FFFFFF';
const BANNER_WARNING_BG = colors.accent_yellow;
const BANNER_WARNING_TXT = colors.bg_v3;

const AUDIO_THROTTLE_MS = 2000;

export function generateFeedback(
  analysis: AnalysisResult,
  lastFeedbackTimestamp: number,
): FeedbackOutput {
  if (analysis.errors.length === 0) {
    return {
      topError: null,
      activeBanner: null,
      keypointColors: {},
      triggerHaptic: false,
      audioMessage: null,
    };
  }

  // Prioritize: critical first, then highest confidence
  const topError = [...analysis.errors].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.confidence - a.confidence;
  })[0];

  const severity = ERROR_SEVERITY[topError.errorId];
  const message = i18n.t(`formErrors.${topError.errorId}`);
  const canPlayAudio = Date.now() - lastFeedbackTimestamp > AUDIO_THROTTLE_MS;
  const isCritical = severity === 'critical';

  return {
    topError,
    activeBanner: {
      errorId: topError.errorId,
      message,
      backgroundColor: isCritical ? BANNER_CRITICAL_BG : BANNER_WARNING_BG,
      textColor: isCritical ? BANNER_CRITICAL_TXT : BANNER_WARNING_TXT,
      severity,
    },
    keypointColors: {},  // TODO: Map affected keypoints to error color
    triggerHaptic: isCritical,
    audioMessage: canPlayAudio ? message : null,
  };
}
