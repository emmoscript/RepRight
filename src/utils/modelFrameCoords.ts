import { Platform } from 'react-native';
import type { Orientation } from 'react-native-vision-camera';

import type { KeyPoint, PoseResult } from '@/modules/movenet';

/**
 * vision-camera-resize-plugin center-crops to a square before scaling when `crop` is omitted.
 * MoveNet coords are 0–1 over that square — map back to full-frame normalized space first,
 * like OpenCV OpenPose scaling with frameWidth / frameHeight (SravB repo).
 */
export function uncropFromCenterSquareCrop(
  x: number,
  y: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number } {
  const fw = Math.max(1, frameWidth);
  const fh = Math.max(1, frameHeight);
  const side = Math.min(fw, fh);
  const cropX = (fw - side) / 2;
  const cropY = (fh - side) / 2;
  return {
    x: (cropX + x * side) / fw,
    y: (cropY + y * side) / fh,
  };
}

/** Upright preview aspect uses swapped buffer dims when sensor buffer is landscape. */
export function orientedPreviewSize(
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
): { width: number; height: number } {
  if (orientation === 'landscape-left' || orientation === 'landscape-right') {
    return { width: frameHeight, height: frameWidth };
  }
  return { width: frameWidth, height: frameHeight };
}

export type FrameCoordOptions = {
  /** Front-camera preview is mirrored; sensor buffer usually is not. */
  mirrorPreview?: boolean;
};

/**
 * Model (crop square) → full buffer → portrait preview normalized (0–1 in contain rect).
 */
export function mapPoseToPreviewSpace(
  pose: PoseResult,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
  options?: FrameCoordOptions,
): PoseResult {
  return {
    ...pose,
    keypoints: pose.keypoints.map((k) =>
      mapKeypointToPreview(k, frameWidth, frameHeight, orientation, options),
    ),
  };
}

function mapKeypointToPreview(
  k: KeyPoint,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
  options?: FrameCoordOptions,
): KeyPoint {
  let { x, y } = uncropFromCenterSquareCrop(k.x, k.y, frameWidth, frameHeight);
  ({ x, y } = mapBufferToPortrait(x, y, orientation));

  // Selfie preview is mirrored; model runs on the unmirrored sensor buffer.
  // Android: landscape swap already lines up with Samsung front preview — extra flip breaks it.
  // iOS: same swap + explicit horizontal mirror to stick on body (not a clone facing you).
  if (options?.mirrorPreview) {
    x = 1 - x;
  }
  return { ...k, x, y };
}

/** Rotate full-frame normalized coords into portrait preview space. */
function mapBufferToPortrait(
  x: number,
  y: number,
  orientation: Orientation,
): { x: number; y: number } {
  if (Platform.OS === 'ios') {
    return mapBufferToPortraitIos(x, y, orientation);
  }
  switch (orientation) {
    case 'landscape-left':
    case 'landscape-right':
      return { x: 1 - y, y: 1 - x };
    case 'portrait-upside-down':
      return { x: 1 - x, y: 1 - y };
    case 'portrait':
    default:
      return { x, y };
  }
}

/** iPhone portrait UI — landscape-right is common for front cam in frame processors. */
function mapBufferToPortraitIos(
  x: number,
  y: number,
  orientation: Orientation,
): { x: number; y: number } {
  switch (orientation) {
    case 'landscape-right':
      return { x: y, y: 1 - x };
    case 'landscape-left':
      return { x: 1 - y, y: x };
    case 'portrait-upside-down':
      return { x: 1 - x, y: 1 - y };
    case 'portrait':
    default:
      return { x, y };
  }
}
