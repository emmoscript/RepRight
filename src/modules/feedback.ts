/**
 * feedback.ts
 * Generates real-time visual and audio feedback from AnalysisResult.
 *
 * Caller owns when to speak (once per error episode). Bar drift (ERR_003)
 * outranks rounding — forward bar looks like a rounded back in 2D.
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

export function generateFeedback(analysis: AnalysisResult): FeedbackOutput {
  if (analysis.errors.length === 0) {
    return {
      topError: null,
      activeBanner: null,
      keypointColors: {},
      triggerHaptic: false,
      audioMessage: null,
    };
  }

  const topError = [...analysis.errors].sort((a, b) => {
    if (a.errorId === 'ERR_003' && b.errorId !== 'ERR_003') return -1;
    if (b.errorId === 'ERR_003' && a.errorId !== 'ERR_003') return 1;
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.confidence - a.confidence;
  })[0];

  const severity = ERROR_SEVERITY[topError.errorId];
  const message = i18n.t(`formErrors.${topError.errorId}`);
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
    keypointColors: {},
    triggerHaptic: isCritical,
    audioMessage: message,
  };
}
