/**
 * movenet.ts
 * MoveNet Lightning inference wrapper.
 * Loads the TFLite model and runs inference on Vision Camera frames.
 *
 * Keypoint indices:
 *  0: nose       5: left_shoulder   6: right_shoulder
 *  9: left_wrist 10: right_wrist   11: left_hip      12: right_hip
 * 13: left_knee 14: right_knee    15: left_ankle    16: right_ankle
 */

export interface KeyPoint {
  y: number;      // normalized 0–1
  x: number;      // normalized 0–1
  score: number;  // confidence 0–1
}

export interface PoseResult {
  keypoints: KeyPoint[];  // always 17 items
  score: number;          // overall pose confidence
  timestamp: number;      // ms since session start
}

export const KEYPOINTS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

export type KeypointName = keyof typeof KEYPOINTS;

// Minimum confidence to trust a keypoint
export const MIN_KEYPOINT_SCORE = 0.3;

/**
 * Initialize TFLite model.
 * Call once at app startup before any inference.
 * Model file: assets/models/movenet_lightning.tflite
 */
export async function initModel(): Promise<void> {
  // TODO: Load model via react-native-fast-tflite
  // const model = await loadTensorflowModel(require('../../assets/models/movenet_lightning.tflite'));
  throw new Error('initModel: not yet implemented');
}

/**
 * Run MoveNet inference on a single camera frame.
 * @param frame - Vision Camera CameraFrame (passed from frame processor)
 * @returns PoseResult with 17 keypoints
 */
export async function runInference(frame: unknown): Promise<PoseResult> {
  // TODO: Implement via TFLite bindings
  // Input: 192x192 RGB image tensor
  // Output: [1, 1, 17, 3] tensor → reshape to 17 KeyPoints
  throw new Error('runInference: not yet implemented');
}
