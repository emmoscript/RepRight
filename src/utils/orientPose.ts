import { Platform } from 'react-native';
import type { Orientation } from 'react-native-vision-camera';

import type { PoseResult } from '@/modules/movenet';

export type PoseOverlayOptions = {
  /** Front camera preview is mirrored; model buffer is not. */
  mirrorX?: boolean;
};

/**
 * Map MoveNet keypoints (192×192 stretch) into portrait overlay space (0–1 within preview).
 *
 * - **iOS**: `outputOrientation="preview"` — coords map directly to the contain preview.
 * - **Android**: landscape sensor buffer uses x↔y swap (Samsung-style side camera).
 */
export function alignPoseToPortraitOverlay(
  pose: PoseResult,
  _frameOrientation: Orientation,
  options?: PoseOverlayOptions,
): PoseResult {
  const mirrorX = options?.mirrorX ?? false;

  if (Platform.OS === 'ios') {
    return {
      ...pose,
      keypoints: pose.keypoints.map((k) => ({
        ...k,
        x: mirrorX ? 1 - k.x : k.x,
        y: k.y,
      })),
    };
  }

  return {
    ...pose,
    keypoints: pose.keypoints.map((k) => ({
      ...k,
      x: 1 - k.y,
      y: 1 - k.x,
    })),
  };
}
