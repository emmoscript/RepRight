/**
 * angles.ts
 * 2D geometric helpers for biomechanical angle calculations.
 * All inputs use MoveNet's normalized coordinate system (0–1).
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Returns the angle at vertex B formed by vectors BA and BC, in degrees.
 * Useful for joint angles: e.g. angleBetween(shoulder, hip, knee) = lumbar angle.
 */
export function angleBetween(A: Point2D, B: Point2D, C: Point2D): number {
  const BA = { x: A.x - B.x, y: A.y - B.y };
  const BC = { x: C.x - B.x, y: C.y - B.y };
  const dot = BA.x * BC.x + BA.y * BC.y;
  const magBA = Math.sqrt(BA.x ** 2 + BA.y ** 2);
  const magBC = Math.sqrt(BC.x ** 2 + BC.y ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/** Euclidean distance between two normalized keypoints */
export function distance(A: Point2D, B: Point2D): number {
  return Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2);
}

/** Horizontal offset (signed) from A to B */
export function horizontalOffset(A: Point2D, B: Point2D): number {
  return B.x - A.x;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
