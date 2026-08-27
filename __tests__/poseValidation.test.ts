import { KEYPOINTS, type PoseResult } from '@/modules/movenet';
import {
  barHeldAtShins,
  isPoseStableForLiftTracking,
  isPoseValid,
  shoulderTrackingBroken,
} from '@/utils/poseValidation';

function poseWithScores(partial: Partial<Record<number, number>>): PoseResult {
  const keypoints = Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, score: 0 }));
  for (const [idx, score] of Object.entries(partial)) {
    keypoints[Number(idx)] = { x: 0.5, y: 0.5, score };
  }
  return { keypoints, score: 0.5, timestamp: 0 };
}

describe('isPoseValid (pre-lift ready gate)', () => {
  it('accepts a plate-height setup with hips and knees visible even if ankles are weak', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.55,
      [KEYPOINTS.RIGHT_HIP]: 0.12,
      [KEYPOINTS.LEFT_KNEE]: 0.48,
      [KEYPOINTS.RIGHT_KNEE]: 0.1,
      [KEYPOINTS.LEFT_ANKLE]: 0.05,
      [KEYPOINTS.RIGHT_ANKLE]: 0.04,
    });
    expect(isPoseValid(pose)).toBe(true);
  });

  it('rejects when hips or knees are missing', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.55,
      [KEYPOINTS.RIGHT_HIP]: 0.4,
      [KEYPOINTS.LEFT_KNEE]: 0.05,
      [KEYPOINTS.RIGHT_KNEE]: 0.04,
      [KEYPOINTS.LEFT_ANKLE]: 0.6,
      [KEYPOINTS.RIGHT_ANKLE]: 0.5,
    });
    expect(isPoseValid(pose)).toBe(false);
  });

  it('does not treat predicted knees as ready-to-start', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.55,
      [KEYPOINTS.RIGHT_HIP]: 0.5,
      [KEYPOINTS.LEFT_KNEE]: 0.22,
      [KEYPOINTS.RIGHT_KNEE]: 0.22,
    });
    pose.keypoints[KEYPOINTS.LEFT_KNEE].source = 'predicted';
    pose.keypoints[KEYPOINTS.RIGHT_KNEE].source = 'predicted';
    expect(isPoseValid(pose)).toBe(false);
  });
});

describe('isPoseStableForLiftTracking (active COUNT gate)', () => {
  it('stays valid when hips are reliable even if knees collapse', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.5,
      [KEYPOINTS.RIGHT_HIP]: 0.48,
      [KEYPOINTS.LEFT_KNEE]: 0.05,
      [KEYPOINTS.RIGHT_KNEE]: 0.04,
    });
    expect(isPoseStableForLiftTracking(pose)).toBe(true);
  });

  it('accepts predicted knees when hips are observed', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.5,
      [KEYPOINTS.RIGHT_HIP]: 0.48,
      [KEYPOINTS.LEFT_KNEE]: 0.22,
      [KEYPOINTS.RIGHT_KNEE]: 0.22,
    });
    pose.keypoints[KEYPOINTS.LEFT_KNEE].source = 'predicted';
    pose.keypoints[KEYPOINTS.RIGHT_KNEE].source = 'predicted';
    expect(isPoseStableForLiftTracking(pose)).toBe(true);
  });

  it('rejects when hips are gone even if knees are predicted', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_HIP]: 0.05,
      [KEYPOINTS.RIGHT_HIP]: 0.04,
      [KEYPOINTS.LEFT_KNEE]: 0.22,
      [KEYPOINTS.RIGHT_KNEE]: 0.22,
    });
    pose.keypoints[KEYPOINTS.LEFT_KNEE].source = 'predicted';
    pose.keypoints[KEYPOINTS.RIGHT_KNEE].source = 'predicted';
    expect(isPoseStableForLiftTracking(pose)).toBe(false);
  });
});

describe('barHeldAtShins / shoulderTrackingBroken', () => {
  it('treats elbow-on-knee as bar against the shins', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_ELBOW]: 0.9,
      [KEYPOINTS.LEFT_KNEE]: 0.9,
    });
    pose.keypoints[KEYPOINTS.LEFT_ELBOW] = { x: 0.5, y: 0.7, score: 0.9 };
    pose.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.51, y: 0.71, score: 0.9 };
    expect(barHeldAtShins(pose)).toBe(true);
  });

  it('flags a shoulder sitting on the biceps', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_SHOULDER]: 0.9,
      [KEYPOINTS.LEFT_ELBOW]: 0.9,
    });
    pose.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.5, y: 0.55, score: 0.9 };
    pose.keypoints[KEYPOINTS.LEFT_ELBOW] = { x: 0.51, y: 0.57, score: 0.9 };
    expect(shoulderTrackingBroken(pose)).toBe(true);
  });

  it('does not flag a normal hanging arm', () => {
    const pose = poseWithScores({
      [KEYPOINTS.LEFT_SHOULDER]: 0.9,
      [KEYPOINTS.LEFT_ELBOW]: 0.9,
    });
    pose.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.5, y: 0.38, score: 0.9 };
    pose.keypoints[KEYPOINTS.LEFT_ELBOW] = { x: 0.48, y: 0.52, score: 0.9 };
    expect(shoulderTrackingBroken(pose)).toBe(false);
  });
});
