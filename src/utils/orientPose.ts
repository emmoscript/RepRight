import { Platform } from 'react-native';
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
  const { x: mx, y: my } = k;
  let x = mx;
  let y = my;

  switch (orientation) {
    case 'landscape-left':
      // Validated on Samsung A17 front cam (portrait UI, landscape-left buffer).
      x = 1 - my;
      y = 1 - mx;
      break;
    case 'landscape-right':
      x = my;
      y = 1 - mx;
      break;
    case 'portrait-upside-down':
      x = 1 - mx;
      y = 1 - my;
      break;
    case 'portrait':
    default:
      break;
  }

  // iPhone portrait preview is 180° vs the Android-validated landscape mapping.
  if (
    Platform.OS === 'ios' &&
    (orientation === 'landscape-left' || orientation === 'landscape-right')
  ) {
    x = 1 - x;
    y = 1 - y;
  }

  return { ...k, x, y };
}
