import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

const HIP_SCORE_MIN = 0.12;
const CENTER_X_LO = 0.38;
const CENTER_X_HI = 0.62;

export type FramingHint = 'left' | 'right' | 'center' | null;

/** Horizontal center of hips in model space (0–1). Side view: one hip often dominates. */
export function bodyCenterX(pose: PoseResult): number | null {
  const kp = pose.keypoints;
  if (!kp || kp.length < 17) return null;
  const lh = kp[KEYPOINTS.LEFT_HIP];
  const rh = kp[KEYPOINTS.RIGHT_HIP];
  const nose = kp[KEYPOINTS.NOSE];
  const samples: number[] = [];
  if (lh && lh.score >= HIP_SCORE_MIN) samples.push(lh.x);
  if (rh && rh.score >= HIP_SCORE_MIN) samples.push(rh.x);
  if (samples.length === 0 && nose && nose.score >= 0.2) samples.push(nose.x);
  if (samples.length === 0) return null;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

export function framingHintFromPose(pose: PoseResult | null, poseValid: boolean): FramingHint {
  if (!pose || !poseValid) return null;
  const x = bodyCenterX(pose);
  if (x == null) return null;
  if (x < CENTER_X_LO) return 'right';
  if (x > CENTER_X_HI) return 'left';
  return 'center';
}
