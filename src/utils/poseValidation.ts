import { KEYPOINTS, MIN_KEYPOINT_SCORE, type PoseResult } from '@/modules/movenet';

const REQUIRED_KEYPOINT_PAIRS: [number, number][] = [
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
  [KEYPOINTS.LEFT_HIP, KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_KNEE, KEYPOINTS.RIGHT_KNEE],
  [KEYPOINTS.LEFT_ANKLE, KEYPOINTS.RIGHT_ANKLE],
];

export function isPoseValid(pose: PoseResult): boolean {
  return REQUIRED_KEYPOINT_PAIRS.every(([leftIdx, rightIdx]) => {
    const left = pose.keypoints[leftIdx];
    const right = pose.keypoints[rightIdx];
    return left.score >= MIN_KEYPOINT_SCORE || right.score >= MIN_KEYPOINT_SCORE;
  });
}
