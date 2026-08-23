import { Platform } from 'react-native';

import {
  inspectPoseMapping,
  mapPoseToPreviewSpace,
  orientedPreviewSize,
  shouldMirrorToMatchPreview,
  uncropFromCenterSquareCrop,
} from '@/utils/modelFrameCoords';
import { keypointsFromMovenetOutput } from '@/modules/movenet';
import type { PoseResult } from '@/modules/movenet';

function poseAt(x: number, y: number): PoseResult {
  const keypoints = Array.from({ length: 17 }, () => ({ x: 0, y: 0, score: 0 }));
  keypoints[0] = { x, y, score: 1 };
  return { keypoints, score: 1, timestamp: 0 };
}

describe('modelFrameCoords', () => {
  it('swaps dimensions for landscape sensor buffers', () => {
    expect(orientedPreviewSize(1920, 1080, 'landscape-left')).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it('uncrops center square crop back to full frame', () => {
    const fw = 1080;
    const fh = 1920;
    const side = Math.min(fw, fh);
    const cropY = (fh - side) / 2;
    const center = uncropFromCenterSquareCrop(0.5, 0.5, fw, fh);
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo((cropY + 0.5 * side) / fh);
  });

  it('maps landscape-left buffer coords to portrait preview space', () => {
    const raw = keypointsFromMovenetOutput(
      new Float32Array([0.5, 0.5, 1, ...new Array(48).fill(0)]),
      0,
    );
    const mapped = mapPoseToPreviewSpace(raw, 1920, 1080, 'landscape-left');
    expect(mapped.keypoints[0]?.x).toBeCloseTo(0.5);
    expect(mapped.keypoints[0]?.y).toBeCloseTo(0.5);
  });

  /**
   * Samsung / Vision Camera landscape-left is confirmed:
   *   x_portrait = 1 - buffer.y
   *   y_portrait = 1 - buffer.x
   * The same Orientation enum must mean the same rotation on iOS.
   * A separate iOS table (y = buffer.x) vertically inverts the overlay.
   */
  it.each(['ios', 'android'] as const)(
    'maps landscape-left with the confirmed formula on %s',
    (os) => {
      const previous = Platform.OS;
      Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
      try {
        const mapped = mapPoseToPreviewSpace(poseAt(0.8, 0.3), 192, 192, 'landscape-left');
        expect(mapped.keypoints[0]?.x).toBeCloseTo(0.7);
        expect(mapped.keypoints[0]?.y).toBeCloseTo(0.2);
      } finally {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: previous });
      }
    },
  );

  it.each(['ios', 'android'] as const)(
    'maps landscape-right with y = buffer.x on %s',
    (os) => {
      const previous = Platform.OS;
      Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
      try {
        const mapped = mapPoseToPreviewSpace(poseAt(0.8, 0.3), 192, 192, 'landscape-right');
        expect(mapped.keypoints[0]?.x).toBeCloseTo(0.7);
        expect(mapped.keypoints[0]?.y).toBeCloseTo(0.8);
      } finally {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: previous });
      }
    },
  );

  it('keeps a standing body upright on iOS landscape-right + front mirror', () => {
    const raw = poseAt(0.32, 0.32);
    raw.keypoints[11] = { x: 0.50, y: 0.63, score: 1 };
    raw.keypoints[15] = { x: 0.68, y: 0.53, score: 1 };
    const mapped = mapPoseToPreviewSpace(raw, 960, 540, 'landscape-right', {
      mirrorPreview: true,
    });
    const diag = inspectPoseMapping(raw, mapped, {
      orientation: 'landscape-right',
      frameWidth: 960,
      frameHeight: 540,
      isMirrored: true,
      mirrorPreview: true,
      pixelFormat: 'yuv',
      platform: 'ios',
    });
    expect(diag.rawAnkleBelowNose).toBe(true);
    expect(diag.mappedAnkleBelowNose).toBe(true);
    expect(diag.flipAt).toBe('none');
    expect(mapped.keypoints[0]!.y).toBeLessThan(mapped.keypoints[15]!.y);
  });

  it('extra preview mirror flips X only, never Y', () => {
    const raw = poseAt(0.8, 0.3);
    const unmirrored = mapPoseToPreviewSpace(raw, 192, 192, 'landscape-right');
    const mirrored = mapPoseToPreviewSpace(raw, 192, 192, 'landscape-right', {
      mirrorPreview: true,
    });
    expect(mirrored.keypoints[0]?.y).toBeCloseTo(unmirrored.keypoints[0]!.y);
    expect(mirrored.keypoints[0]?.x).toBeCloseTo(1 - unmirrored.keypoints[0]!.x);
  });

  it('does not extra-flip X when the iOS frame is already mirrored', () => {
    expect(
      shouldMirrorToMatchPreview({ platform: 'ios', useFront: true, isMirrored: true }),
    ).toBe(false);
    expect(
      shouldMirrorToMatchPreview({ platform: 'ios', useFront: true, isMirrored: false }),
    ).toBe(true);
    expect(
      shouldMirrorToMatchPreview({ platform: 'android', useFront: true, isMirrored: false }),
    ).toBe(false);
  });

  it('flags mapping as the flip source when raw is upright but mapped is inverted', () => {
    const raw = poseAt(0.5, 0.2);
    raw.keypoints[15] = { x: 0.5, y: 0.9, score: 1 };
    const mapped = poseAt(0.5, 0.85);
    mapped.keypoints[15] = { x: 0.5, y: 0.15, score: 1 };
    const diag = inspectPoseMapping(raw, mapped, {
      orientation: 'landscape-left',
      frameWidth: 192,
      frameHeight: 192,
      isMirrored: false,
      mirrorPreview: false,
      pixelFormat: 'yuv',
      platform: 'ios',
    });
    expect(diag.flipAt).toBe('mapping');
    expect(diag.rawAnkleBelowNose).toBe(true);
    expect(diag.mappedAnkleBelowNose).toBe(false);
  });
});
