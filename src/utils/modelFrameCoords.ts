import type { Orientation } from 'react-native-vision-camera';

import type { KeyPoint, PoseResult } from '@/modules/movenet';

/**
 * vision-camera-resize-plugin center-crops to a square before scaling when `crop` is omitted.
 * MoveNet coords are 0–1 over that square — map back to full-frame normalized space first.
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
  /** Extra horizontal flip so overlay X matches a mirrored selfie preview. Never changes Y. */
  mirrorPreview?: boolean;
};

/** Extra X-flip only when iOS front preview is mirrored but the frame buffer is not. */
export function shouldMirrorToMatchPreview(opts: {
  platform: string;
  useFront: boolean;
  isMirrored: boolean;
}): boolean {
  if (opts.platform !== 'ios' || !opts.useFront) return false;
  return !opts.isMirrored;
}

/**
 * Model (crop square) → full buffer → portrait preview normalized (0–1 in contain rect).
 * Kept on JS thread (17 keypoints) — avoid GPU rotate/mirror in the resize worklet.
 *
 * `frame.orientation` from Vision Camera is the same enum on iOS and Android.
 * Landscape-left (Samsung): x_portrait = 1 - buffer.y, y_portrait = 1 - buffer.x
 * Landscape-right (iPhone logs): same X formula, y_portrait = buffer.x
 * Applying the left formula to the right orientation inverts Y and kills rep counting.
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

  // X only — never Y. Callers set mirrorPreview via shouldMirrorToMatchPreview.
  if (options?.mirrorPreview) {
    x = 1 - x;
  }
  return { ...k, x, y };
}

export type PoseLandmarkSample = {
  x: number;
  y: number;
  score: number;
};

export type PoseMappingDiag = {
  platform: string;
  orientation: Orientation;
  frameWidth: number;
  frameHeight: number;
  isMirrored: boolean;
  mirrorPreview: boolean;
  pixelFormat: string;
  raw: { nose: PoseLandmarkSample; hip: PoseLandmarkSample; ankle: PoseLandmarkSample };
  mapped: { nose: PoseLandmarkSample; hip: PoseLandmarkSample; ankle: PoseLandmarkSample };
  rawAnkleBelowNose: boolean | null;
  mappedAnkleBelowNose: boolean | null;
  /** Where a standing body (ankle below nose) would be lost. */
  flipAt: 'raw' | 'mapping' | 'none' | 'unknown';
};

function sampleKp(
  pose: PoseResult,
  idx: number,
): PoseLandmarkSample {
  const k = pose.keypoints[idx];
  return {
    x: round4(k?.x ?? 0),
    y: round4(k?.y ?? 0),
    score: round4(k?.score ?? 0),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function ankleBelowNose(nose: PoseLandmarkSample, ankle: PoseLandmarkSample): boolean | null {
  if (nose.score < 0.15 || ankle.score < 0.15) return null;
  return ankle.y > nose.y;
}

/**
 * Compare raw MoveNet coords vs preview mapping for a standing body.
 * Portrait Y increases downward, so ankle.y > nose.y when the overlay is upright.
 */
export function inspectPoseMapping(
  rawPose: PoseResult,
  mappedPose: PoseResult,
  meta: {
    orientation: Orientation;
    frameWidth: number;
    frameHeight: number;
    isMirrored: boolean;
    mirrorPreview: boolean;
    pixelFormat: string;
    platform: string;
  },
): PoseMappingDiag {
  const raw = {
    nose: sampleKp(rawPose, 0),
    hip: sampleKp(rawPose, 11),
    ankle: sampleKp(rawPose, 15),
  };
  const mapped = {
    nose: sampleKp(mappedPose, 0),
    hip: sampleKp(mappedPose, 11),
    ankle: sampleKp(mappedPose, 15),
  };
  const rawAnkleBelowNose = ankleBelowNose(raw.nose, raw.ankle);
  const mappedAnkleBelowNose = ankleBelowNose(mapped.nose, mapped.ankle);
  let flipAt: PoseMappingDiag['flipAt'] = 'unknown';
  if (rawAnkleBelowNose == null || mappedAnkleBelowNose == null) {
    flipAt = 'unknown';
  } else if (rawAnkleBelowNose && mappedAnkleBelowNose) {
    flipAt = 'none';
  } else if (!rawAnkleBelowNose && !mappedAnkleBelowNose) {
    flipAt = 'raw';
  } else if (rawAnkleBelowNose && !mappedAnkleBelowNose) {
    flipAt = 'mapping';
  } else {
    flipAt = 'none';
  }
  return {
    platform: meta.platform,
    orientation: meta.orientation,
    frameWidth: meta.frameWidth,
    frameHeight: meta.frameHeight,
    isMirrored: meta.isMirrored,
    mirrorPreview: meta.mirrorPreview,
    pixelFormat: meta.pixelFormat,
    raw,
    mapped,
    rawAnkleBelowNose,
    mappedAnkleBelowNose,
    flipAt,
  };
}

export function formatPoseMappingDiag(d: PoseMappingDiag): string {
  return [
    `${d.platform} ${d.orientation} mir=${d.isMirrored ? 1 : 0} prevMir=${d.mirrorPreview ? 1 : 0} ${d.frameWidth}x${d.frameHeight} ${d.pixelFormat}`,
    `raw N.y=${d.raw.nose.y} H.y=${d.raw.hip.y} A.y=${d.raw.ankle.y}`,
    `map N.y=${d.mapped.nose.y} H.y=${d.mapped.hip.y} A.y=${d.mapped.ankle.y}`,
    `flipAt=${d.flipAt} rawOK=${d.rawAnkleBelowNose} mapOK=${d.mappedAnkleBelowNose}`,
  ].join('\n');
}

/**
 * Rotate sensor-buffer coords into portrait preview space.
 *
 * Android (Samsung) reports landscape-left; confirmed:
 *   x_portrait = 1 - buffer.y
 *   y_portrait = 1 - buffer.x
 *
 * iPhone front camera reports landscape-right + isMirrored. Device logs (960×540)
 * showed raw ankle.y > nose.y (upright) but y_portrait = 1 - buffer.x inverted the
 * body. landscape-right therefore uses y_portrait = buffer.x so a standing hip
 * still increases Y when the athlete hinges — that is what the rep FSM needs.
 */
function mapBufferToPortrait(
  x: number,
  y: number,
  orientation: Orientation,
): { x: number; y: number } {
  switch (orientation) {
    case 'landscape-left':
      return { x: 1 - y, y: 1 - x };
    case 'landscape-right':
      return { x: 1 - y, y: x };
    case 'portrait-upside-down':
      return { x: 1 - x, y: 1 - y };
    case 'portrait':
    default:
      return { x, y };
  }
}
