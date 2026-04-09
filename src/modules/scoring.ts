/**
 * scoring.ts
 * Per-rep scoring algorithm (0–100).
 *
 * Deductions:
 *  critical error: -25 pts
 *  warning  error: -10 pts
 *  info     error: -3  pts
 *
 * Each unique errorId is counted once per rep (not per frame).
 */

import { BiomechanicalError, ErrorId, Severity } from './analyzer';

const ERROR_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  warning: 10,
  info: 3,
};

export type ScoreLabel = 'Excellent' | 'Good' | 'Needs Work' | 'Poor Form';

export interface RepScore {
  score: number;         // 0–100
  label: ScoreLabel;
  color: string;         // hex
}

const ERROR_SEVERITIES: Record<ErrorId, Severity> = {
  ERR_001: 'critical',
  ERR_002: 'critical',
  ERR_003: 'warning',
  ERR_004: 'warning',
  ERR_005: 'warning',
};

export function calculateRepScore(errors: BiomechanicalError[]): RepScore {
  const uniqueErrorIds = new Set(errors.map((e) => e.errorId));
  let deduction = 0;

  for (const errorId of uniqueErrorIds) {
    const severity = ERROR_SEVERITIES[errorId];
    deduction += ERROR_WEIGHTS[severity];
  }

  const score = Math.max(0, 100 - deduction);
  return { score, ...scoreLabel(score) };
}

function scoreLabel(score: number): { label: ScoreLabel; color: string } {
  if (score >= 90) return { label: 'Excellent', color: '#00FF87' };
  if (score >= 70) return { label: 'Good', color: '#7ED957' };
  if (score >= 50) return { label: 'Needs Work', color: '#FFB800' };
  return { label: 'Poor Form', color: '#FF4444' };
}
