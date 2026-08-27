import type { ErrorId, Phase } from '@/modules/analyzer';
import { DEADLIFT_REP_THRESH } from '@/utils/deadliftRep';

export type RepPhase = 'need_return' | 'need_setup' | 'need_lockout';

/** Extra slack on lockoutTopY for idle detection (smoothed hip Y lags slightly). */
export const LOCKOUT_IDLE_SLACK = 0.012;

/**
 * When a detector may drive the live banner / voice.
 * ERR_003 waits for standing baseline and a hinge/pull — idle standing is not bar drift.
 */
export function formFeedbackLiveForError(
  errorId: ErrorId,
  repPhase: RepPhase,
  hipY: number | null,
  standing: number | null,
  armedDeep: number,
  analyzerPhase?: Phase,
): boolean {
  const lockoutZoneY =
    standing != null
      ? standing +
        DEADLIFT_REP_THRESH.lockoutStandingSlack +
        DEADLIFT_REP_THRESH.lockoutCountSlack
      : null;
  const atLockoutTop =
    standing != null &&
    lockoutZoneY != null &&
    hipY != null &&
    hipY <= lockoutZoneY + LOCKOUT_IDLE_SLACK;
  const bottomGate =
    standing != null ? standing + DEADLIFT_REP_THRESH.setupDropBelowStanding : null;
  const atSetupBottom = standing != null && hipY != null && bottomGate != null && hipY > bottomGate;

  switch (errorId) {
    case 'ERR_001':
    case 'ERR_002':
      if (standing == null) return false;
      return repPhase === 'need_lockout' && armedDeep > 0;
    case 'ERR_003':
      if (standing == null) return false;
      if (analyzerPhase === 'lockout' || analyzerPhase === 'descent') return false;
      if (repPhase === 'need_lockout' && armedDeep > 0) return true;
      if (repPhase === 'need_setup' && atSetupBottom) return true;
      return analyzerPhase === 'pull_initiation' || analyzerPhase === 'mid_pull';
    case 'ERR_004':
      if (standing == null || !atLockoutTop) return false;
      return (
        analyzerPhase === 'lockout' ||
        repPhase === 'need_lockout' ||
        repPhase === 'need_return'
      );
    case 'ERR_005':
      if (standing == null) return false;
      return repPhase === 'need_setup' && analyzerPhase === 'setup' && atSetupBottom;
    default:
      return false;
  }
}
