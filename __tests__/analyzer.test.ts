import { analyzePose, detectPhase } from '@/modules/analyzer';
import { KEYPOINTS, type PoseResult } from '@/modules/movenet';

function blankPose(): PoseResult['keypoints'] {
  return Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, score: 0.9 }));
}

function poseWithHipY(hipY: number, rounded = false): PoseResult {
  const keypoints = blankPose();
  const shoulderY = rounded ? hipY + 0.02 : hipY - 0.18;
  keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: shoulderY, score: 0.85 };
  keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: shoulderY + 0.01, score: 0.82 };
  keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: hipY, score: 0.88 };
  keypoints[KEYPOINTS.RIGHT_HIP] = { x: 0.52, y: hipY + 0.01, score: 0.86 };
  keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.5, y: hipY + 0.16, score: 0.2 };
  keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.48, y: hipY + 0.17, score: 0.18 };
  keypoints[KEYPOINTS.LEFT_ANKLE] = { x: 0.46, y: hipY + 0.32, score: 0.75 };
  keypoints[KEYPOINTS.RIGHT_ANKLE] = { x: 0.44, y: hipY + 0.33, score: 0.7 };
  keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.42, y: hipY + 0.28, score: 0.8 };
  keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.4, y: hipY + 0.29, score: 0.75 };
  return { keypoints, score: 0.9, timestamp: Date.now() };
}

function buildPullHistory(bottomY: number, endY: number, steps: number): PoseResult[] {
  const history: PoseResult[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps > 1 ? i / (steps - 1) : 0;
    const hipY = bottomY - t * (bottomY - endY);
    history.push({ ...poseWithHipY(hipY, false), timestamp: i });
  }
  return history;
}

describe('analyzer', () => {
  it('returns phase and angles for a synthetic pose', () => {
    const p = poseWithHipY(0.55);
    const r = analyzePose(p, []);
    expect(r.phase).toBeDefined();
    expect(r.angles).toBeDefined();
  });

  it('classifies mid-pull from ROM history while hip rises', () => {
    const history = buildPullHistory(0.62, 0.58, 6);
    const current = poseWithHipY(0.56, false);
    expect(detectPhase(current, history)).toBe('mid_pull');
  });

  it('detects ERR_002 when hips rise faster than shoulders at pull start', () => {
    const history = buildPullHistory(0.62, 0.595, 5);
    const current = poseWithHipY(0.59, false);
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: 0.534, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: 0.535, score: 0.82 };
    const prev = history[history.length - 1];
    prev.keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: 0.605, score: 0.88 };
    prev.keypoints[KEYPOINTS.RIGHT_HIP] = { x: 0.52, y: 0.606, score: 0.86 };
    prev.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: 0.535, score: 0.85 };
    prev.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: 0.536, score: 0.82 };
    const r = analyzePose(current, history);
    expect(r.errors.some((e) => e.errorId === 'ERR_002')).toBe(true);
    expect(r.errors.some((e) => e.errorId === 'ERR_001')).toBe(false);
  });

  it('keeps ERR_001 for rounded torso without hips shooting first', () => {
    const history = buildPullHistory(0.62, 0.58, 6);
    for (const frame of history) {
      const hipY = frame.keypoints[KEYPOINTS.LEFT_HIP].y;
      frame.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: hipY - 0.06, score: 0.85 };
      frame.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: hipY - 0.05, score: 0.82 };
    }
    const current = poseWithHipY(0.56, true);
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: 0.58, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: 0.581, score: 0.82 };
    current.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.5, y: 0.72, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.48, y: 0.73, score: 0.83 };
    current.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.50, y: 0.72, score: 0.8 };
    current.keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.48, y: 0.73, score: 0.75 };
    current.keypoints[KEYPOINTS.LEFT_ANKLE] = { x: 0.46, y: 0.88, score: 0.75 };
    const r = analyzePose(current, history);
    expect(r.phase === 'pull_initiation' || r.phase === 'mid_pull').toBe(true);
    expect(r.errors.some((e) => e.errorId === 'ERR_001')).toBe(true);
    expect(r.errors.some((e) => e.errorId === 'ERR_002')).toBe(false);
  });

  it('does not flag ERR_001 for neutral torso at setup', () => {
    const current = poseWithHipY(0.62, false);
    const r = analyzePose(current, buildPullHistory(0.62, 0.62, 3));
    expect(r.errors.some((e) => e.errorId === 'ERR_001')).toBe(false);
  });

  it('detects ERR_003 when wrist drifts from ankle mid-pull', () => {
    const history = buildPullHistory(0.62, 0.58, 6);
    const current = poseWithHipY(0.56, false);
    current.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.72, y: 0.62, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.7, y: 0.63, score: 0.8 };
    current.keypoints[KEYPOINTS.LEFT_ANKLE] = { x: 0.46, y: 0.88, score: 0.75 };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('mid_pull');
    expect(r.errors.some((e) => e.errorId === 'ERR_003')).toBe(true);
  });

  it('does not flag ERR_003 during pull initiation (wrist noise)', () => {
    const history = buildPullHistory(0.62, 0.615, 5);
    const current = poseWithHipY(0.578, false);
    current.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.72, y: 0.62, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.7, y: 0.63, score: 0.8 };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('pull_initiation');
    expect(r.errors.some((e) => e.errorId === 'ERR_003')).toBe(false);
  });

  it('prefers ERR_003 over false ERR_001 when bar drifts forward', () => {
    const history = buildPullHistory(0.62, 0.58, 6);
    const current = poseWithHipY(0.56, true);
    current.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.72, y: 0.62, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.7, y: 0.63, score: 0.8 };
    current.keypoints[KEYPOINTS.LEFT_ANKLE] = { x: 0.46, y: 0.88, score: 0.75 };
    const r = analyzePose(current, history);
    expect(r.errors.some((e) => e.errorId === 'ERR_003')).toBe(true);
    expect(r.errors.some((e) => e.errorId === 'ERR_001')).toBe(false);
  });

  it('detects ERR_005 at setup when shoulder is behind wrist', () => {
    const history = buildPullHistory(0.66, 0.38, 8);
    const p = poseWithHipY(0.64, false);
    p.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.62, y: 0.48, score: 0.9 };
    p.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.48, y: 0.55, score: 0.9 };
    const r = analyzePose(p, history);
    expect(r.phase).toBe('setup');
    expect(r.errors.some((e) => e.errorId === 'ERR_005')).toBe(true);
  });

  it('detects ERR_004 when torso leans back at lockout', () => {
    const history = buildPullHistory(0.62, 0.38, 8);
    const current = poseWithHipY(0.38, false);
    // Same-side chain: shoulder well behind hip, torso nearly stacked (open lumbar).
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.66, y: 0.18, score: 0.9 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.64, y: 0.19, score: 0.88 };
    current.keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: 0.38, score: 0.88 };
    current.keypoints[KEYPOINTS.RIGHT_HIP] = { x: 0.52, y: 0.39, score: 0.86 };
    current.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.42, y: 0.58, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.40, y: 0.59, score: 0.83 };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('lockout');
    expect(r.errors.some((e) => e.errorId === 'ERR_004')).toBe(true);
  });

  it('does not flag ERR_004 for packed chest / retracted scapulae at lockout', () => {
    const history = buildPullHistory(0.62, 0.38, 8);
    const current = poseWithHipY(0.38, false);
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.58, y: 0.20, score: 0.9 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.56, y: 0.21, score: 0.88 };
    current.keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: 0.38, score: 0.88 };
    current.keypoints[KEYPOINTS.RIGHT_HIP] = { x: 0.52, y: 0.39, score: 0.86 };
    current.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.52, y: 0.56, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.50, y: 0.57, score: 0.83 };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('lockout');
    expect(r.errors.some((e) => e.errorId === 'ERR_004')).toBe(false);
  });

  it('does not flag ERR_004 for neutral lockout posture', () => {
    const history = buildPullHistory(0.62, 0.40, 8);
    const current = poseWithHipY(0.40, false);
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.56, y: 0.24, score: 0.9 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.54, y: 0.25, score: 0.88 };
    current.keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: 0.40, score: 0.88 };
    current.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.5, y: 0.56, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.48, y: 0.57, score: 0.83 };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('lockout');
    expect(r.errors.some((e) => e.errorId === 'ERR_004')).toBe(false);
  });

  it('does not flag ERR_005 when standing idle at session start', () => {
    const p = poseWithHipY(0.38, false);
    p.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.62, y: 0.48, score: 0.9 };
    p.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.48, y: 0.55, score: 0.9 };
    const r = analyzePose(p, [p, p, p]);
    expect(r.errors.some((e) => e.errorId === 'ERR_005')).toBe(false);
  });

  it('does not flag ERR_004 when lockout knees are predicted', () => {
    const history = buildPullHistory(0.62, 0.38, 8);
    const current = poseWithHipY(0.38, false);
    current.keypoints[KEYPOINTS.LEFT_SHOULDER] = { x: 0.66, y: 0.18, score: 0.9 };
    current.keypoints[KEYPOINTS.RIGHT_SHOULDER] = { x: 0.64, y: 0.19, score: 0.88 };
    current.keypoints[KEYPOINTS.LEFT_HIP] = { x: 0.54, y: 0.38, score: 0.88 };
    current.keypoints[KEYPOINTS.RIGHT_HIP] = { x: 0.52, y: 0.39, score: 0.86 };
    current.keypoints[KEYPOINTS.LEFT_KNEE] = { x: 0.42, y: 0.58, score: 0.22, source: 'predicted' };
    current.keypoints[KEYPOINTS.RIGHT_KNEE] = { x: 0.40, y: 0.59, score: 0.22, source: 'predicted' };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('lockout');
    expect(r.errors.some((e) => e.errorId === 'ERR_004')).toBe(false);
  });

  it('does not use a predicted ankle for ERR_003 when the hip is still close', () => {
    const history = buildPullHistory(0.62, 0.58, 6);
    const current = poseWithHipY(0.56, false);
    current.keypoints[KEYPOINTS.LEFT_WRIST] = { x: 0.6, y: 0.62, score: 0.85 };
    current.keypoints[KEYPOINTS.RIGHT_WRIST] = { x: 0.58, y: 0.63, score: 0.8 };
    current.keypoints[KEYPOINTS.LEFT_ANKLE] = { x: 0.46, y: 0.88, score: 0.22, source: 'predicted' };
    current.keypoints[KEYPOINTS.RIGHT_ANKLE] = { x: 0.44, y: 0.89, score: 0.22, source: 'predicted' };
    const r = analyzePose(current, history);
    expect(r.phase).toBe('mid_pull');
    expect(r.errors.some((e) => e.errorId === 'ERR_003')).toBe(false);
  });
});
