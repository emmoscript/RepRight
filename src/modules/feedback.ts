/**
 * feedback.ts
 * Generates real-time visual and audio feedback from AnalysisResult.
 *
 * Throttling rules:
 *  - Audio: max 1 cue per 2 seconds
 *  - Visual: stays for duration of error
 *  - Trigger only if error persists for ≥ 3 consecutive frames (enforced by caller)
 */

import { AnalysisResult, ErrorId } from './analyzer';
import { colors } from '../theme/colors';

export interface FeedbackOutput {
  activeBanner: {
    errorId: string;
    message: string;
    color: string;
  } | null;
  keypointColors: Record<number, string>;  // keypoint index → hex
  triggerHaptic: boolean;
  audioMessage: string | null;
}

interface ErrorMeta {
  message: string;
  color: string;
  severity: 'critical' | 'warning';
}

const ERROR_META: Record<ErrorId, ErrorMeta> = {
  ERR_001: {
    message: 'Engage your lats. Drive chest up.',
    color: colors.accent_red,
    severity: 'critical',
  },
  ERR_002: {
    message: 'Lower your hips. Set your back angle first.',
    color: colors.accent_red,
    severity: 'critical',
  },
  ERR_003: {
    message: 'Keep the bar close. Drag it up your legs.',
    color: colors.accent_yellow,
    severity: 'warning',
  },
  ERR_004: {
    message: "Stand tall. Don't lean back at the top.",
    color: colors.accent_yellow,
    severity: 'warning',
  },
  ERR_005: {
    message: 'Shoulders over the bar. Shift weight forward.',
    color: colors.accent_yellow,
    severity: 'warning',
  },
};

const AUDIO_THROTTLE_MS = 2000;

export function generateFeedback(
  analysis: AnalysisResult,
  lastFeedbackTimestamp: number,
): FeedbackOutput {
  if (analysis.errors.length === 0) {
    return {
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

  const meta = ERROR_META[topError.errorId];
  const canPlayAudio = Date.now() - lastFeedbackTimestamp > AUDIO_THROTTLE_MS;

  return {
    activeBanner: {
      errorId: topError.errorId,
      message: meta.message,
      color: meta.color,
    },
    keypointColors: {},  // TODO: Map affected keypoints to error color
    triggerHaptic: meta.severity === 'critical',
    audioMessage: canPlayAudio ? meta.message : null,
  };
}
