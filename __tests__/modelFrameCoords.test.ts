import {
  mapPoseToPreviewSpace,
  orientedPreviewSize,
  uncropFromCenterSquareCrop,
} from '@/utils/modelFrameCoords';
import { keypointsFromMovenetOutput } from '@/modules/movenet';

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
});
