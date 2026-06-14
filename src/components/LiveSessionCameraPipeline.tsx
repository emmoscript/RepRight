import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Worklets, useSharedValue as useWorkletSharedValue } from 'react-native-worklets-core';
import {
  Camera,
  useCameraFormat,
  useFrameProcessor,
  type CameraDevice,
  type Orientation,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { diagBreadcrumb } from '@/lib/crashDiag';

const INFER_INTERVAL_MS = 72;

export type LiveSessionFrameBytesHandler = (
  bytes: number[],
  ts: number,
  frameOrientation: Orientation,
) => void;

type Props = {
  device: CameraDevice;
  isActive: boolean;
  portraitVideoAspectRatio: number;
  enableInference: boolean;
  onFrameBytesRef: React.MutableRefObject<LiveSessionFrameBytesHandler>;
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
  onFrameBytesRef,
}: Props) {
  useEffect(() => {
    diagBreadcrumb('live_session:camera_pipeline_mount', { enableInference });
    return () => diagBreadcrumb('live_session:camera_pipeline_unmount');
  }, [enableInference]);

  const format = useCameraFormat(device, [
    { videoAspectRatio: portraitVideoAspectRatio },
    { fps: 30 },
  ]);
  const { resize } = useResizePlugin();
  const lastInferAt = useWorkletSharedValue(0);

  const runFrameBytes = useMemo(
    () =>
      Worklets.createRunOnJS((bytes: number[], ts: number, frameOrientation: Orientation) => {
        onFrameBytesRef.current(bytes, ts, frameOrientation);
      }),
    [onFrameBytesRef],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const now = Date.now();
      if (now - lastInferAt.value < INFER_INTERVAL_MS) return;
      lastInferAt.value = now;
      try {
        const r = resize(frame, {
          scale: { width: 192, height: 192 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        runFrameBytes(Array.from(new Uint8Array(r)), Date.now(), frame.orientation);
      } catch {
        // worklet must never throw to caller
      }
    },
    [resize, runFrameBytes, lastInferAt],
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
