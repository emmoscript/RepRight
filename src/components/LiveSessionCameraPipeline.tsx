import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { TensorflowModel } from 'react-native-fast-tflite';
import {
  Worklets,
  useSharedValue as useWorkletSharedValue,
} from 'react-native-worklets-core';
import {
  Camera,
  useCameraFormat,
  useFrameProcessor,
  type CameraDevice,
  type Orientation,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { diagBreadcrumb } from '@/lib/crashDiag';

const INFER_INTERVAL_MS = Platform.OS === 'android' ? 180 : 140;

export type InferenceTensorKind = 'f32' | 'u8' | 'i8';

export type LiveSessionInferenceHandler = (
  values: number[],
  kind: InferenceTensorKind,
  ts: number,
  frameOrientation: Orientation,
) => void;

/** Fallback path: ~110 KB Uint8Array via SharedValue (not 110k JS numbers). */
export type LiveSessionFramePixelsHandler = (
  pixels: Uint8Array,
  ts: number,
  frameOrientation: Orientation,
) => void;

type Props = {
  device: CameraDevice;
  isActive: boolean;
  portraitVideoAspectRatio: number;
  enableInference: boolean;
  model: TensorflowModel | null;
  onInferenceResultRef: React.MutableRefObject<LiveSessionInferenceHandler>;
  onFramePixelsRef: React.MutableRefObject<LiveSessionFramePixelsHandler>;
};

/**
 * Vision Camera + frame processor isolated from LiveSessionScreen so hooks are not
 * registered during the navigation transition (Reanimated + ScrollView teardown crash on iOS Release).
 */
export function LiveSessionCameraPipeline({
  device,
  isActive,
  portraitVideoAspectRatio,
  enableInference,
  model,
  onInferenceResultRef,
  onFramePixelsRef,
}: Props) {
  useEffect(() => {
    diagBreadcrumb('live_session:camera_pipeline_mount', { enableInference });
    return () => diagBreadcrumb('live_session:camera_pipeline_unmount');
  }, [enableInference]);

  const format = useCameraFormat(device, [
    { videoAspectRatio: portraitVideoAspectRatio },
    { fps: Platform.OS === 'android' ? 20 : 30 },
    ...(Platform.OS === 'android'
      ? [{ videoResolution: { width: 720, height: 1280 } }]
      : []),
  ]);
  const { resize } = useResizePlugin();
  const lastInferAt = useWorkletSharedValue(0);
  const sharedPixels = useWorkletSharedValue<Uint8Array | null>(null);
  const sharedTs = useWorkletSharedValue(0);
  const sharedOrientation = useWorkletSharedValue<Orientation>('portrait');

  const runInferenceResult = useMemo(
    () =>
      Worklets.createRunOnJS(
        (values: number[], kind: InferenceTensorKind, ts: number, frameOrientation: Orientation) => {
          onInferenceResultRef.current(values, kind, ts, frameOrientation);
        },
      ),
    [onInferenceResultRef],
  );

  const deliverFramePixels = useMemo(
    () =>
      Worklets.createRunOnJS(() => {
        const pixels = sharedPixels.value;
        if (pixels == null) return;
        onFramePixelsRef.current(pixels, sharedTs.value, sharedOrientation.value);
      }),
    [onFramePixelsRef, sharedPixels, sharedOrientation, sharedTs],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const now = Date.now();
      if (now - lastInferAt.value < INFER_INTERVAL_MS) return;
      lastInferAt.value = now;
      try {
        const resized = resize(frame, {
          scale: { width: 192, height: 192 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        // Best: infer in worklet → only ~51 floats cross the bridge.
        if (model != null) {
          try {
            const outs = model.runSync([resized]);
            const out = outs[0];
            if (out != null) {
              runInferenceResult(Array.from(out as ArrayLike<number>), 'f32', now, frame.orientation);
              return;
            }
          } catch {
            // Fall through — JS thread runSync via SharedValue.
          }
        }

        sharedPixels.value = resized.slice();
        sharedTs.value = now;
        sharedOrientation.value = frame.orientation;
        deliverFramePixels();
      } catch {
        // worklet must never throw to caller
      }
    },
    [
      resize,
      runInferenceResult,
      deliverFramePixels,
      lastInferAt,
      model,
      sharedPixels,
      sharedTs,
      sharedOrientation,
    ],
  );

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      {...(format ? { format } : {})}
      resizeMode="contain"
      frameProcessor={enableInference ? frameProcessor : undefined}
      androidPreviewViewType="texture-view"
      outputOrientation="preview"
      pixelFormat="yuv"
    />
  );
}
