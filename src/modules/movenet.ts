/**
 * movenet.ts
 * MoveNet Lightning — TFLite init, output parsing, and mock pose for development
 * when the bundled .tflite is empty or failed to load.
 *
 * Keypoint indices match TensorFlow MoveNet 17-landmark layout.
 */

import type { TensorflowModel } from 'react-native-fast-tflite';
import { Platform } from 'react-native';

export interface KeyPoint {
  y: number;
  x: number;
  score: number;
}

export interface PoseResult {
  keypoints: KeyPoint[];
  score: number;
  timestamp: number;
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

export const MIN_KEYPOINT_SCORE = 0.3;

let loadedModel: TensorflowModel | null = null;
let modelLoadError: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require('../../assets/models/movenet_lightning.tflite') as number;

let tfliteLoadError: string | null = null;

async function loadTensorflowModelSafe(
  source: number,
  delegate: 'metal' | 'core-ml' | 'default' | 'android-gpu' | 'nnapi',
): Promise<TensorflowModel | null> {
  try {
    const { loadTensorflowModel } = await import('react-native-fast-tflite');
    return await loadTensorflowModel(source, delegate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    tfliteLoadError = msg;
    console.warn('[MoveNet] TFLite runtime unavailable:', msg);
    return null;
  }
}

/**
 * Try hardware-accelerated delegates first, fall back to CPU.
 * - iOS:     Core ML → CPU
 * - Android: GPU → NNAPI → CPU
 * Hardware delegates cut MoveNet Lightning latency from ~80ms to ~15ms.
 */
export async function initModel(): Promise<boolean> {
  if (loadedModel) return true;
  modelLoadError = null;
  tfliteLoadError = null;

  // 'metal' = iOS GPU (fastest), 'core-ml' = iOS Neural Engine, 'android-gpu' = Android GPU
  const delegates =
    Platform.OS === 'ios'
      ? (['metal', 'core-ml', 'default'] as const)
      : (['android-gpu', 'nnapi', 'default'] as const);

  for (const delegate of delegates) {
    const model = await loadTensorflowModelSafe(MODEL_ASSET, delegate);
    if (model != null) {
      loadedModel = model;
      console.log(`[MoveNet] loaded with delegate: ${delegate}`);
      return true;
    }
    console.log(`[MoveNet] delegate "${delegate}" unavailable`);
  }

  modelLoadError = tfliteLoadError ?? 'All delegates failed';
  console.warn('[MoveNet] model load failed on all delegates');
  return false;
}

export function getModel(): TensorflowModel | null {
  return loadedModel;
}

export function getModelLoadError(): string | null {
  return modelLoadError;
}

function toMovenetFloatArray(out: ArrayBuffer | ArrayBufferView): Float32Array {
  if (out instanceof ArrayBuffer) return new Float32Array(out);
  if (out instanceof Float32Array) return out;
  if (out instanceof Uint8Array) {
    const floats = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) floats[i] = out[i] / 255;
    return floats;
  }
  if (out instanceof Int8Array) {
    const floats = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) floats[i] = (out[i] + 128) / 255;
    return floats;
  }
  if (out instanceof Uint16Array) {
    const floats = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) floats[i] = out[i] / 65535;
    return floats;
  }
  if (out instanceof Int16Array) {
    const floats = new Float32Array(out.length);
    for (let i = 0; i < out.length; i += 1) floats[i] = (out[i] + 32768) / 65535;
    return floats;
  }
  return new Float32Array(out.buffer);
}

/** MoveNet single-pose output: [1,1,17,3] (y, x, confidence). */
export function keypointsFromMovenetOutput(
  out: ArrayBuffer | ArrayBufferView,
  frameTimestamp: number,
): PoseResult {
  const floats = out instanceof ArrayBuffer ? new Float32Array(out) : toMovenetFloatArray(out);
  const n = 17;
  const keypoints: KeyPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    keypoints.push({
      y: floats[i * 3 + 0],
      x: floats[i * 3 + 1],
      score: floats[i * 3 + 2],
    });
  }
  const score = keypoints.reduce((a, k) => a + k.score, 0) / n;
  return { keypoints, score, timestamp: frameTimestamp };
}

/** Mock pose for dev when TFLite is unavailable. */
export function getMockPose(frameTimestamp: number, phaseT: number): PoseResult {
  const breath = 0.02 * Math.sin(phaseT * 0.006);
  const y = (r: number) => r + breath;
  const x = (c: number) => c + breath * 0.5;
  const mk = (px: number, py: number, s = 0.92): KeyPoint => ({ x: x(px), y: y(py), score: s });
  const keypoints: KeyPoint[] = new Array(17);
  for (let i = 0; i < 17; i += 1) keypoints[i] = mk(0, 0, 0.1);
  keypoints[0] = mk(0.38, 0.18);
  keypoints[5] = mk(0.32, 0.3);
  keypoints[6] = mk(0.3, 0.3);
  keypoints[7] = mk(0.4, 0.4);
  keypoints[8] = mk(0.4, 0.4);
  keypoints[9] = mk(0.4, 0.5);
  keypoints[10] = mk(0.4, 0.5);
  keypoints[11] = mk(0.32, 0.6);
  keypoints[12] = mk(0.3, 0.6);
  keypoints[13] = mk(0.3, 0.8);
  keypoints[14] = mk(0.3, 0.8);
  keypoints[15] = mk(0.3, 0.95);
  keypoints[16] = mk(0.3, 0.95);
  return { keypoints, score: 0.88, timestamp: frameTimestamp };
}
