import { useIsFocused, useNavigation } from '@react-navigation/native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonOverlay } from '@/components/SkeletonOverlay';
import { analyzePose } from '@/modules/analyzer';
import { generateFeedback } from '@/modules/feedback';
import {
  getModel,
  getMockPose,
  initModel,
  keypointsFromMovenetOutput,
  type PoseResult,
} from '@/modules/movenet';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { isPoseValid } from '@/utils/poseValidation';

const HOLD_MS = 800;

type Flow = 'search' | 'countdown' | 'active' | 'pose_lost';

export function LiveSessionScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const clearResults = useSessionResultStore((s) => s.clear);
  const addErrors = useSessionResultStore((s) => s.addErrors);
  const setStarted = useSessionResultStore((s) => s.setStartedAt);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { resize } = useResizePlugin();

  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  };

  const [flow, setFlow] = useState<Flow>('search');
  const [count, setCount] = useState(3);
  const flowRef = useRef<Flow>('search');
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  const holdAt = useRef<number | null>(null);
  const poseRef = useRef<PoseResult | null>(null);
  const historyRef = useRef<PoseResult[]>([]);
  const lastAudioAt = useRef(0);
  const streak = useRef<Record<string, number>>({});

  const [uiPose, setUiPose] = useState<PoseResult | null>(null);
  const [banner, setBanner] = useState<{ message: string; color: string } | null>(null);
  const [useMock, setUseMock] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    clearResults();
    setStarted(Date.now());
  }, [clearResults, setStarted]);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    void (async () => {
      const ok = await initModel();
      const m = getModel();
      const ready = ok && m != null;
      setModelReady(ready);
      setUseMock(!ready);
    })();
  }, []);

  const ingestPose = useCallback(
    (pose: PoseResult) => {
      poseRef.current = pose;
      const h = historyRef.current;
      h.push(pose);
      if (h.length > 8) h.shift();
      setUiPose(pose);

      const stage = flowRef.current;
      if (stage !== 'active' && stage !== 'pose_lost') {
        return;
      }

      const analysis = analyzePose(pose, h.slice(0, -1));
      const st: Record<string, number> = { ...streak.current };
      for (const e of analysis.errors) {
        st[e.errorId] = (st[e.errorId] ?? 0) + 1;
      }
      for (const id of Object.keys(st)) {
        if (!analysis.errors.find((e) => e.errorId === id)) st[id] = 0;
      }
      streak.current = st;
      const confirmed = analysis.errors.filter((e) => (st[e.errorId] ?? 0) >= 3);

      if (confirmed.length) {
        addErrors(confirmed);
        const fb = generateFeedback({ ...analysis, errors: confirmed }, lastAudioAt.current);
        if (fb.activeBanner) {
          setBanner({ message: fb.activeBanner.message, color: fb.activeBanner.color });
        } else {
          setBanner(null);
        }
        if (fb.triggerHaptic) {
          void impactAsync(ImpactFeedbackStyle.Medium);
        }
        if (fb.audioMessage) {
          lastAudioAt.current = performance.now();
          Speech.speak(fb.audioMessage, { language: 'en', rate: 0.95 });
        }
      } else {
        setBanner(null);
      }
    },
    [addErrors],
  );

  const onNativeFrame = useCallback(
    (u8: Uint8Array, ts: number) => {
      const m = getModel();
      if (!m) return;
      try {
        const outs = m.runSync([u8]);
        const f = outs[0];
        if (f instanceof Float32Array) {
          ingestPose(keypointsFromMovenetOutput(f, ts));
        }
      } catch {
        // ignore single-frame errors (e.g. wrong tensor layout during dev)
      }
    },
    [ingestPose],
  );

  useEffect(() => {
    if (!isFocused || !useMock) return;
    const id = setInterval(() => {
      const t = Date.now();
      ingestPose(getMockPose(t, t));
    }, 200);
    return () => clearInterval(id);
  }, [isFocused, useMock, ingestPose]);

  const runJsFrame = useCallback(
    (u8: Uint8Array, ts: number) => {
      onNativeFrame(u8, ts);
    },
    [onNativeFrame],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const r = resize(frame, {
        scale: { width: 192, height: 192 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });
      const u8 = new Uint8Array(r);
      const ts = Date.now();
      runOnJS(runJsFrame)(u8, ts);
    },
    [resize, runJsFrame],
  );

  // 7A–7C–7D machine
  useEffect(() => {
    const id = setInterval(() => {
      const pose = poseRef.current;
      const valid = pose != null && isPoseValid(pose);
      if (flowRef.current === 'search') {
        if (valid) {
          if (holdAt.current == null) holdAt.current = Date.now();
          if (Date.now() - (holdAt.current ?? 0) >= HOLD_MS) {
            holdAt.current = null;
            setCount(3);
            setFlow('countdown');
          }
        } else {
          holdAt.current = null;
        }
        return;
      }
      if (flowRef.current === 'countdown') {
        if (!valid) {
          setFlow('search');
          holdAt.current = null;
        }
      } else if (flowRef.current === 'active') {
        if (!valid) setFlow('pose_lost');
      } else if (flowRef.current === 'pose_lost') {
        if (valid) setFlow('active');
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (flow !== 'countdown') return;
    setCount(3);
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          setFlow('active');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [flow]);

  const skColor =
    flow === 'countdown' || (flow === 'search' && uiPose && isPoseValid(uiPose))
      ? colors.primary_green
      : flow === 'pose_lost' || (flow === 'search' && (!uiPose || !isPoseValid(uiPose)))
        ? colors.skeleton_muted_v3
        : colors.primary_green;
  const showStop = flow === 'active' || flow === 'pose_lost';
  const runAnalysis = flow === 'active' || flow === 'pose_lost';
  const showSkeleton = uiPose && (flow === 'search' || flow === 'countdown' || runAnalysis);

  const useFrame = modelReady && !useMock;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {hasPermission && device ? (
        <View style={styles.cameraBox}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            frameProcessor={useFrame ? frameProcessor : undefined}
            pixelFormat="yuv"
            fps={30}
          />
        </View>
      ) : (
        <View style={[styles.cameraBox, styles.cameraPlaceholder]}>
          <Text style={styles.caption}>
            {hasPermission ? 'No camera device.' : 'Camera permission required for live analysis.'}
          </Text>
        </View>
      )}

      {showSkeleton && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkeletonOverlay
            width={layout.w}
            height={layout.h * 0.6}
            keypoints={uiPose!.keypoints}
            lineColor={skColor}
            pointColor={skColor}
          />
        </View>
      )}

      <View style={styles.hud} pointerEvents="box-none">
        {flow === 'search' && <Text style={styles.hudTitle}>Side view — get full body in frame</Text>}
        {flow === 'countdown' && <Text style={styles.countText}>{String(count || 0)}</Text>}
        {flow === 'pose_lost' && <Text style={styles.warn}>Pose lost</Text>}
        {useMock && <Text style={styles.dev}>Mock pose — add real movenet .tflite for inference</Text>}
      </View>

      {banner && runAnalysis && (
        <View style={[styles.banner, { backgroundColor: banner.color }]}>
          <Text style={styles.bannerText}>{banner.message}</Text>
        </View>
      )}

      {showStop && (
        <View style={styles.footer}>
          <PrimaryButton
            title="End session"
            variant="danger"
            onPress={() => navigation.navigate('SessionComplete' as never)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  cameraBox: { flex: 1, backgroundColor: '#000' },
  cameraPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  hud: { ...StyleSheet.absoluteFillObject, alignItems: 'center', paddingTop: 60 },
  hudTitle: { color: colors.text_primary, fontFamily: typography.fontFamily.semibold, fontSize: 18 },
  countText: { color: colors.primary_green, fontSize: 80, fontFamily: typography.fontFamily.bold, marginTop: 40 },
  warn: { color: colors.accent_yellow, fontSize: 18, marginTop: 24, fontFamily: typography.fontFamily.medium },
  dev: { color: colors.text_muted, fontSize: 12, position: 'absolute', bottom: 100 },
  banner: { position: 'absolute', bottom: 160, left: 16, right: 16, borderRadius: 10, padding: 12 },
  bannerText: { color: '#0A0A0A', fontFamily: typography.fontFamily.semibold, fontSize: 15, textAlign: 'center' },
  caption: { color: colors.text_secondary, textAlign: 'center', padding: 16, fontSize: 14 },
  footer: { padding: 20, paddingBottom: 32, backgroundColor: colors.bg_v3 },
});
