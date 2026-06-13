import type { BiomechanicalError, Phase } from '@/modules/analyzer';

/** Form error captured during live session with rep/set context for post-session breakdown. */
export type RecordedFormError = BiomechanicalError & {
  setNumber: number;
  repNumber: number;
  phase: Phase;
};
