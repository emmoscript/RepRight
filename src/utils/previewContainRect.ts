/**
 * Maps normalized keypoints (0–1 over full sensor buffer) onto screen space when the
 * camera preview uses VisionCamera `resizeMode="contain"`: letterboxing must match.
 */

export type ContainRect = { ox: number; oy: number; vw: number; vh: number };

/**
 * @param screenW Root layout width (e.g. full screen portrait)
 * @param screenH Root layout height
 * @param videoWidth Native format video width (may be landscape)
 * @param videoHeight Native format video height
 */
export function getContainPreviewRect(
  screenW: number,
  screenH: number,
  videoWidth: number,
  videoHeight: number,
): ContainRect {
  const fw = Math.max(1, videoWidth);
  const fh = Math.max(1, videoHeight);
  /** Upright preview width/height ratio (sensor is typically landscape numbers). */
  const imageAspect = Math.min(fw, fh) / Math.max(fw, fh);
  const sw = Math.max(1, screenW);
  const sh = Math.max(1, screenH);

  const scaleH = sw / imageAspect;
  if (scaleH <= sh) {
    const vh = scaleH;
    const vw = sw;
    return { ox: 0, oy: (sh - vh) / 2, vw, vh };
  }
  const vh = sh;
  const vw = sh * imageAspect;
  return { ox: (sw - vw) / 2, oy: 0, vw, vh };
}

export function poseToContainedPx(kx: number, ky: number, rect: ContainRect) {
  return { x: rect.ox + kx * rect.vw, y: rect.oy + ky * rect.vh };
}
