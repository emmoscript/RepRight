import { analyzePose } from '@/modules/analyzer';
import type { PoseResult } from '@/modules/movenet';

describe('analyzer', () => {
  it('returns phase and angles for a synthetic pose', () => {
    const keypoints = Array.from({ length: 17 }, (_, i) => ({
      x: 0.4,
      y: 0.15 + i * 0.04,
      score: 0.9,
    })) as PoseResult['keypoints'];
    const p: PoseResult = { keypoints, score: 0.9, timestamp: 0 };
    const r = analyzePose(p, []);
    expect(r.phase).toBeDefined();
    expect(r.angles).toBeDefined();
  });
});
