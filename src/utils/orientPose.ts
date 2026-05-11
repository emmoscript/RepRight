import type { Orientation } from 'react-native-vision-camera';

import type { PoseResult } from '@/modules/movenet';

/**
 * Map MoveNet keypoints (192×192 stretch from landscape sensor buffer) into portrait overlay space.
 *
 * Samsung A17 front cam + `landscape-left`: modelo x ≈ vertical de pantalla, modelo y ≈ horizontal.
 * `frameOrientation` is ignored here — this app targets that pipeline until a per-device matrix exists.
 */
export function alignPoseToPortraitOverlay(
  pose: PoseResult,
  _frameOrientation: Orientation,
): PoseResult {
  return {
    ...pose,
    keypoints: pose.keypoints.map((k) => ({
      ...k,
      x: 1 - k.y,
      y: 1 - k.x,
    })),
  };
}
