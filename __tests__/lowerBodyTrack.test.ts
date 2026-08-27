import { KEYPOINTS, type PoseResult } from '@/modules/movenet';
import {
  createLowerBodyTrackState,
  stabilizeLowerBodyPose,
  LOWER_BODY_TRACK,
} from '@/utils/lowerBodyTrack';

function kp(x: number, y: number, score: number, source?: 'observed' | 'predicted') {
  return source ? { x, y, score, source } : { x, y, score };
}

function poseAt(
  knee: { x: number; y: number; score: number },
  ankle: { x: number; y: number; score: number },
  ts = 0,
): PoseResult {
  const keypoints = Array.from({ length: 17 }, () => kp(0.4, 0.4, 0.8));
  keypoints[KEYPOINTS.LEFT_KNEE] = kp(knee.x, knee.y, knee.score);
  keypoints[KEYPOINTS.RIGHT_KNEE] = kp(knee.x + 0.02, knee.y, knee.score);
  keypoints[KEYPOINTS.LEFT_ANKLE] = kp(ankle.x, ankle.y, ankle.score);
  keypoints[KEYPOINTS.RIGHT_ANKLE] = kp(ankle.x + 0.02, ankle.y, ankle.score);
  return { keypoints, score: 0.7, timestamp: ts };
}

describe('stabilizeLowerBodyPose', () => {
  it('updates the anchor on high-confidence detections (observed)', () => {
    const state = createLowerBodyTrackState();
    const raw = poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 });
    const out = stabilizeLowerBodyPose(raw, state, 1000);
    const knee = out.pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source ?? 'observed').toBe('observed');
    expect(knee.x).toBeCloseTo(0.32);
    expect(knee.score).toBe(0.9);
  });

  it('holds last ankle position when score collapses (predicted, capped score)', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    const seen = poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 });
    state = stabilizeLowerBodyPose(seen, state, t0).state;

    const occluded = poseAt(
      { x: 0.12, y: 0.55, score: 0.12 },
      { x: 0.08, y: 0.4, score: 0.1 },
    );
    const out = stabilizeLowerBodyPose(occluded, state, t0 + 200);
    const ankle = out.pose.keypoints[KEYPOINTS.LEFT_ANKLE];
    expect(ankle.source).toBe('predicted');
    expect(ankle.x).toBeCloseTo(0.31);
    expect(ankle.y).toBeCloseTo(0.92);
    expect(ankle.score).toBe(LOWER_BODY_TRACK.predictedScore);
    expect(ankle.score).toBeLessThan(LOWER_BODY_TRACK.observeMin);
  });

  it('rejects a large posterior knee jump even if mid-confidence', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const jumped = poseAt(
      { x: 0.12, y: 0.72, score: 0.35 },
      { x: 0.31, y: 0.92, score: 0.88 },
    );
    const knee = stabilizeLowerBodyPose(jumped, state, t0 + 100).pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source).toBe('predicted');
    expect(knee.x).toBeCloseTo(0.32);
  });

  it('allows knee Y to change when score is usable and X stays near the anchor', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.62, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const flexed = poseAt(
      { x: 0.33, y: 0.78, score: 0.42 },
      { x: 0.31, y: 0.92, score: 0.7 },
    );
    const knee = stabilizeLowerBodyPose(flexed, state, t0 + 120).pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source ?? 'observed').toBe('observed');
    expect(knee.y).toBeCloseTo(0.78);
    expect(knee.x).toBeCloseTo(0.33);
  });

  it('stops holding after maxHoldMs and passes raw through', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const occluded = poseAt(
      { x: 0.1, y: 0.4, score: 0.08 },
      { x: 0.1, y: 0.4, score: 0.08 },
    );
    const out = stabilizeLowerBodyPose(occluded, state, t0 + LOWER_BODY_TRACK.maxHoldMs + 50);
    const ankle = out.pose.keypoints[KEYPOINTS.LEFT_ANKLE];
    expect(ankle.source ?? 'observed').not.toBe('predicted');
    expect(ankle.x).toBeCloseTo(0.1);
    expect(ankle.score).toBeCloseTo(0.08);
  });

  it('does not seed an ankle that sits at hip height', () => {
    const state = createLowerBodyTrackState();
    const fake = poseAt({ x: 0.32, y: 0.45, score: 0.9 }, { x: 0.31, y: 0.42, score: 0.9 });
    const seeded = stabilizeLowerBodyPose(fake, state, 1000);
    expect(seeded.state.anchors[KEYPOINTS.LEFT_ANKLE]).toBeUndefined();
    expect(seeded.pose.keypoints[KEYPOINTS.LEFT_ANKLE].x).toBeCloseTo(0.31);
  });

  it('does not seed an ankle anchor from a frame-edge hallucination', () => {
    const state = createLowerBodyTrackState();
    const edge = poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.016, y: 0.51, score: 0.43 });
    const seeded = stabilizeLowerBodyPose(edge, state, 1000);
    expect(seeded.pose.keypoints[KEYPOINTS.LEFT_ANKLE].source).not.toBe('predicted');
    expect(seeded.pose.keypoints[KEYPOINTS.LEFT_ANKLE].x).toBeCloseTo(0.016);

    const later = poseAt({ x: 0.12, y: 0.55, score: 0.12 }, { x: 0.02, y: 0.4, score: 0.1 });
    const held = stabilizeLowerBodyPose(later, seeded.state, 1200);
    expect(held.pose.keypoints[KEYPOINTS.LEFT_ANKLE].source ?? 'observed').not.toBe('predicted');
    expect(held.pose.keypoints[KEYPOINTS.LEFT_ANKLE].x).toBeCloseTo(0.02);
  });

  it('does not modify hips or shoulders', () => {
    const raw = poseAt({ x: 0.32, y: 0.72, score: 0.2 }, { x: 0.31, y: 0.92, score: 0.2 });
    raw.keypoints[KEYPOINTS.LEFT_HIP] = kp(0.41, 0.51, 0.91);
    raw.keypoints[KEYPOINTS.LEFT_SHOULDER] = kp(0.39, 0.28, 0.93);
    const out = stabilizeLowerBodyPose(raw, createLowerBodyTrackState(), 0);
    expect(out.pose.keypoints[KEYPOINTS.LEFT_HIP]).toEqual(raw.keypoints[KEYPOINTS.LEFT_HIP]);
    expect(out.pose.keypoints[KEYPOINTS.LEFT_SHOULDER]).toEqual(
      raw.keypoints[KEYPOINTS.LEFT_SHOULDER],
    );
  });
});
