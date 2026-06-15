import type { Orientation } from 'react-native-vision-camera';

import type { KeyPoint, PoseResult } from '@/modules/movenet';

/**
 * Map MoveNet keypoints (192×192 stretch of the native frame buffer) into portrait
 * preview space (0–1 within the contain preview).
 *
 * Frame processors ignore `outputOrientation` — buffers stay in sensor layout and
 * {@link Orientation} tells how they relate to the upright preview (Vision Camera docs).
 */
export function alignPoseToPortraitOverlay(
  pose: PoseResult,
  frameOrientation: Orientation,
): PoseResult {
  return {
    ...pose,
    keypoints: pose.keypoints.map((k) => mapKeypointToPortrait(k, frameOrientation)),
  };
}

function mapKeypointToPortrait(k: KeyPoint, orientation: Orientation): KeyPoint {
  const { x, y } = k;

  switch (orientation) {
    case 'landscape-left':
      // Validated on Samsung A17 front cam (portrait UI, landscape-left buffer).
      return { ...k, x: 1 - y, y: 1 - x };
    case 'landscape-right':
      // Typical iPhone portrait buffer orientation (counter-rotate to preview).
      return { ...k, x: y, y: 1 - x };
    case 'portrait-upside-down':
      return { ...k, x: 1 - x, y: 1 - y };
    case 'portrait':
    default:
      return { ...k, x, y };
  }
}
