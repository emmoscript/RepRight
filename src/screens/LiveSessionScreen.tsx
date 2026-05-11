import { useIsFocused, useNavigation, type NavigationProp } from '@react-navigation/native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutChangeEvent,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Worklets } from 'react-native-worklets-core';
import {
  Camera,
  getCameraDevice,
  useCameraDevice,
  useCameraDevices,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
  type Orientation,
  type PhysicalCameraDeviceType,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import {
  SvgCameraReverseOutline,
  SvgChevronBack,
  SvgHudCheckCircle,
  SvgHudWalkPerson,
  SvgHudWarnTriangle,
  SvgVolumeMuted,
  SvgVolumeOn,
} from '@/components/liveSession/LiveHudIcons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SkeletonOverlay } from '@/components/SkeletonOverlay';
import {
  getModel,
  getMockPose,
  initModel,
  keypointsFromMovenetOutput,
  type PoseResult,
} from '@/modules/movenet';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { barbellProxyFromWrists } from '@/utils/barbellProxy';
import type { DeadliftFormCue } from '@/utils/deadliftPhase';
import { inferDeadliftFormCue, lateralHipHingeDegrees } from '@/utils/deadliftPhase';
import { DEADLIFT_REP_THRESH, primaryHipY } from '@/utils/deadliftRep';
import { alignPoseToPortraitOverlay } from '@/utils/orientPose';
import { getContainPreviewRect, type ContainRect } from '@/utils/previewContainRect';
import { isPoseStableForLiftTracking, isPoseValid } from '@/utils/poseValidation';

// ─── Constants ────────────────────────────────────────────────────────────────

/** After “POSITION OK”: shorter than notebook (no streak there) — still lets user freeze before countdown. */
const HOLD_MS = 550;
const RING_SZ = 160;
const RING_R = 60;
const RING_C = 2 * Math.PI * RING_R;
/**
 * Minimum ms between inferences — flat interval reduces burst load on the UI thread.
 * ~14 fps cap; GPU delegate usually infers in 15–25 ms — 72 ms is a pragmatic balance vs UI latency.
 */
const INFER_INTERVAL_MS = 72;

/** State tick still 100ms; streak × tick ≈ min time “valid” before leaving search (~400–550 ms typical). */
const SEARCH_VALID_STREAK = 5;
const POSE_LOST_INVALID_STREAK = 28;
const POSE_RECOVER_VALID_STREAK = 6;
/** Brief flicker invalid while idle in POSITION OK shouldn’t reboot search (notebook has no analogue). */
const DETECTED_INVALID_STREAK_TO_LEAVE = 5;

/** Horizontal inset from screen edge so centered title clears back / flip buttons (~16 pad + 42 btn + spacing). */
const HEADER_TITLE_SIDE_GUTTER = 70;
/** `left` / `right` for title strip inside padded header (`HEADER_TITLE_SIDE_GUTTER − header horizontal padding`). */
const HEADER_TITLE_RAIL_H_INSET = HEADER_TITLE_SIDE_GUTTER - 16;
/** Mute FAB `bottom` when stats strip visible (approx stats panel height + internal padding). */
const MUTE_FAB_ABOVE_STATS = 296;
/** Push header controls down from status bar to clear camera letterboxing. */
const HEADER_CONTROLS_EXTRA_DOWN = 14;
/** Raise mute FAB slightly from bottom edge. */
const MUTE_FAB_RAISE = 22;
/** Extra offset when stats strip is hidden — keeps FAB off search / countdown overlays. */
const MUTE_FAB_CLEAR_HUD = 40;
/**
 * Vertical space reserved with status + title row in `topScrim` (must match `topScrim` height formula).
 * Alerts sit below this so they don’t stack under the header buttons / title.
 */
const HEADER_SCRIM_BODY_PX = 80;

type Flow = 'search' | 'detected' | 'countdown' | 'active' | 'pose_lost';
type WorkletKind = 'f32' | 'u8' | 'i8';

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveSessionScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clearResults = useSessionResultStore((s) => s.clear);
  const setStarted = useSessionResultStore((s) => s.setStartedAt);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const { requestPermission } = useCameraPermission();
  const [useFront, setUseFront] = useState(true);
  const position = useFront ? 'front' : 'back';

  /** Prefer simplest logical cam (widest-compatible on Samsung/MediaTek). Falls back via getCameraDevice. */
  const wideFilter = useMemo(
    () => ({ physicalDevices: ['wide-angle-camera'] as PhysicalCameraDeviceType[] }),
    [],
  );
  const hookedDevice = useCameraDevice(position, wideFilter);
  const allDevices = useCameraDevices();
  const device = useMemo(
    () =>
      hookedDevice ??
      getCameraDevice(allDevices, position, wideFilter) ??
      getCameraDevice(allDevices, position) ??
      allDevices.find((d) => d.position === position),
    [hookedDevice, allDevices, position, wideFilter],
  );

  /** Portrait UI aspect ratio (VisionCamera expects width/height; sensor is landscape; see Snapchat template). */
  const portraitVideoAspectRatio = Math.max(winH, 1) / Math.max(winW, 1);
  const format = useCameraFormat(device ?? undefined, [{ videoAspectRatio: portraitVideoAspectRatio }, { fps: 30 }]);

  const permissionStatus = Camera.getCameraPermissionStatus();
  const cameraGranted = permissionStatus === 'granted';
  const { resize } = useResizePlugin();

  // ── Layout ─────────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  }, []);

  const previewContain = useMemo((): ContainRect => {
    if (layout.w < 16 || layout.h < 16) {
      return { ox: 0, oy: 0, vw: Math.max(1, layout.w), vh: Math.max(1, layout.h) };
    }
    if (!format?.videoWidth || !format?.videoHeight) {
      return { ox: 0, oy: 0, vw: layout.w, vh: layout.h };
    }
    return getContainPreviewRect(layout.w, layout.h, format.videoWidth, format.videoHeight);
  }, [layout.w, layout.h, format]);

  // ── Session flow ────────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<Flow>('search');
  const [countdown, setCountdown] = useState(3);
  const [audioOn, setAudioOn] = useState(true);
  const audioOnRef = useRef(true);
  const [reps, setReps] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const flowRef = useRef<Flow>('search');
  const searchValidStreakRef = useRef(0);
  const detectedInvalidStreakRef = useRef(0);
  const poseInvalidStreakRef = useRef(0);
  const poseRecoverStreakRef = useRef(0);
  const repPhaseRef = useRef<'need_setup' | 'need_lockout'>('need_setup');
  const setupStreakRef = useRef(0);
  const lockoutStreakRef = useRef(0);
  const activeEnteredRef = useRef(false);
  const poseRef = useRef<PoseResult | null>(null);
  const historyRef = useRef<PoseResult[]>([]);
  const sessionStartRef = useRef(0);
  /** Dev: log raw tensor output once (avoid 10/s spam in Metro). */
  const didLogOnce = useRef(false);
  /** Dev: log VisionCamera `frame.orientation` only when it changes (avoid console spam). */
  const lastLoggedOrientation = useRef<string>('');
  /** Wrist-proxy “floor” at end of setup (max Y near shins)—not latched when standing tall at session start. */
  const barFloorBaselineRef = useRef<number | null>(null);
  /** Tracks deepest bar proxy (max Y) while arming setup for current rep cycle. */
  const barPeakYSetupRef = useRef(0);
  /** Deepest hip Y while arming setup (max Y in portrait). */
  const deepestSetupHipYRef = useRef(0);
  /** Snapshot of deepest hip Y when switching to need_lockout (ascent requires this floor). */
  const armedDeepHipYRef = useRef(0);
  const coachCueRef = useRef<DeadliftFormCue>('UNKNOWN');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [uiPose, setUiPose] = useState<PoseResult | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  // ── Shared value for frame-processor throttle (accessible from worklet) ────
  const lastInferAt = useSharedValue(0);

  // ── Pulsing dot animations (7A search state) ────────────────────────────────
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);
  const d1Style = useAnimatedStyle(() => ({ opacity: d1.value }));
  const d2Style = useAnimatedStyle(() => ({ opacity: d2.value }));
  const d3Style = useAnimatedStyle(() => ({ opacity: d3.value }));

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  /** Dev: allow one-shot tensor log again after leaving this screen. */
  useEffect(() => {
    if (isFocused) return;
    didLogOnce.current = false;
  }, [isFocused]);

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    if (!audioOn) void Speech.stop();
  }, [audioOn]);

  useEffect(() => {
    if (flow !== 'search') {
      d1.value = 0.3;
      d2.value = 0.3;
      d3.value = 0.3;
      return;
    }
    const pulse = () =>
      withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(0.3, { duration: 500 })),
        -1,
      );
    d1.value = pulse();
    d2.value = withDelay(200, pulse());
    d3.value = withDelay(400, pulse());
  }, [flow, d1, d2, d3]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    clearResults();
    setStarted(Date.now());
    setReps(0);
  }, [clearResults, setStarted]);

  useEffect(() => () => { void Speech.stop(); }, []);

  useEffect(() => {
    if (permissionStatus === 'granted') return;
    void requestPermission();
  }, [permissionStatus, requestPermission]);

  /** Re-evaluate permission when returning from Settings — only re-prompt when explicitly denied. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const status = Camera.getCameraPermissionStatus();
      if (status === 'denied') void requestPermission();
    });
    return () => sub.remove();
  }, [requestPermission]);

  useEffect(() => {
    void (async () => {
      const ok = await initModel();
      const ready = ok && getModel() != null;
      setModelReady(ready);
      setUseMock(__DEV__ && !ready);
    })();
  }, []);

  // ── Session timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (flow !== 'active' && flow !== 'pose_lost') return;
    if (sessionStartRef.current === 0) sessionStartRef.current = Date.now();
    const id = setInterval(
      () => setElapsedSec(Math.floor((Date.now() - sessionStartRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [flow]);

  // ── Pose ingestion (simple mode: no form analyzer; reps via hip Y in active) ─
  const ingestPose = useCallback((pose: PoseResult) => {
    poseRef.current = pose;
    const h = historyRef.current;
    h.push(pose);
    if (h.length > 8) h.shift();
    setUiPose(pose);

    const stage = flowRef.current;
    if (stage === 'active') {
      const bar = barbellProxyFromWrists(pose);

      let displacement = 0;
      const y = primaryHipY(pose);

      if (repPhaseRef.current === 'need_setup') {
        if (bar != null && y != null && y > DEADLIFT_REP_THRESH.setupMinY * 0.92) {
          barPeakYSetupRef.current = Math.max(barPeakYSetupRef.current, bar.y);
        }
      }

      const floorY = barFloorBaselineRef.current;
      if (bar && floorY != null) displacement = Math.max(0, floorY - bar.y);

      const hingeDeg = lateralHipHingeDegrees(pose);
      if (hingeDeg != null) {
        coachCueRef.current = inferDeadliftFormCue(hingeDeg, displacement, displacement < 0.06);
      }

      if (y != null) {
        if (repPhaseRef.current === 'need_setup') {
          if (y > DEADLIFT_REP_THRESH.setupMinY) {
            deepestSetupHipYRef.current = Math.max(deepestSetupHipYRef.current, y);
            setupStreakRef.current += 1;
            lockoutStreakRef.current = 0;
            if (setupStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveSetupFrames) {
              armedDeepHipYRef.current = Math.max(
                deepestSetupHipYRef.current,
                DEADLIFT_REP_THRESH.setupMinY,
              );
              deepestSetupHipYRef.current = 0;
              repPhaseRef.current = 'need_lockout';
              setupStreakRef.current = 0;
              const peak = barPeakYSetupRef.current;
              if (peak > 0) {
                barFloorBaselineRef.current = peak;
              } else if (bar != null) {
                barFloorBaselineRef.current = bar.y;
              }
              barPeakYSetupRef.current = 0;
            }
          } else {
            setupStreakRef.current = 0;
            barPeakYSetupRef.current = 0;
            deepestSetupHipYRef.current = 0;
          }
        } else {
          const deep = armedDeepHipYRef.current;
          const ascent = deep > 0 ? deep - y : 0;
          const bottomOk = deep >= DEADLIFT_REP_THRESH.setupMinY;
          if (
            bottomOk &&
            y < DEADLIFT_REP_THRESH.lockoutMaxY &&
            ascent >= DEADLIFT_REP_THRESH.minHipAscentNorm
          ) {
            lockoutStreakRef.current += 1;
            setupStreakRef.current = 0;
            if (lockoutStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveLockoutFrames) {
              lockoutStreakRef.current = 0;
              armedDeepHipYRef.current = 0;
              repPhaseRef.current = 'need_setup';
              setReps((r) => r + 1);
              void impactAsync(ImpactFeedbackStyle.Medium);
            }
          } else {
            lockoutStreakRef.current = 0;
          }
        }
      } else if (repPhaseRef.current === 'need_lockout') {
        lockoutStreakRef.current = 0;
      }
    }
  }, []);

  // ── Mock pose loop (dev only, only if TFLite failed) ───────────────────────
  useEffect(() => {
    if (!__DEV__ || !isFocused || !useMock) return;
    const id = setInterval(() => ingestPose(getMockPose(Date.now(), Date.now())), 200);
    return () => clearInterval(id);
  }, [isFocused, useMock, ingestPose]);

  // ── Coordinate transforms ──────────────────────────────────────────────────
  /**
   * vision-camera-resize-plugin STRETCHES to 192×192 (no crop).
   * Model output maps to screen via alignPoseToPortraitOverlay.
   * Many Android front cameras (e.g. Samsung) already mirror the preview — do not mirror pose again
   * or the skeleton flips horizontally. Use plain `aligned` for overlay.
   */

  // ── Worklet result handler ─────────────────────────────────────────────────
  const onWorkletResult = useCallback(
    (values: number[], kind: WorkletKind, ts: number, frameOrientation: Orientation) => {
      if (__DEV__ && !didLogOnce.current) {
        didLogOnce.current = true;
        console.log('[output] kind:', kind, 'length:', values.length);
        console.log(
          '[output] first 9 values:',
          values.slice(0, 9).map((v) => v.toFixed(3)),
        );
        // Flat tensor: kp i → y @ 3i, x @ 3i+1, score @ 3i+2 (MoveNet). Before alignPose / parsing.
        if (values.length >= 51) {
          const nose = { y: values[0], x: values[1], s: values[2] };
          const lShoulder = { y: values[15], x: values[16], s: values[17] };
          const lHip = { y: values[33], x: values[34], s: values[35] };
          const lAnkle = { y: values[45], x: values[46], s: values[47] };
          console.log('[RAW] nose:', JSON.stringify(nose));
          console.log('[RAW] lShoulder:', JSON.stringify(lShoulder));
          console.log('[RAW] lHip:', JSON.stringify(lHip));
          console.log('[RAW] lAnkle:', JSON.stringify(lAnkle));
        }
      }
      try {
        if (__DEV__) {
          const o = String(frameOrientation);
          if (lastLoggedOrientation.current !== o) {
            lastLoggedOrientation.current = o;
            console.log('[LiveSession] frame.orientation →', o);
          }
        }
        const raw =
          kind === 'f32'
            ? keypointsFromMovenetOutput(Float32Array.from(values), ts)
            : kind === 'u8'
              ? keypointsFromMovenetOutput(Uint8Array.from(values), ts)
              : keypointsFromMovenetOutput(Int8Array.from(values), ts);
        const aligned = alignPoseToPortraitOverlay(raw, frameOrientation);
        ingestPose(aligned);
      } catch {
        // swallow — worklet errors must not crash JS thread
      }
    },
    [ingestPose],
  );

  const runOnJS = useCallback(
    Worklets.createRunOnJS(
      (
        values: number[],
        kind: WorkletKind,
        ts: number,
        frameOrientation: Orientation,
      ) => onWorkletResult(values, kind, ts, frameOrientation),
    ),
    [onWorkletResult],
  );

  // ── Frame processor ────────────────────────────────────────────────────────
  // KEY FIX: gate check comes FIRST so resize() is never called on throttled frames.
  // Flat-interval throttle via Reanimated SharedValue (no modulo = no burst stutter).
  const model = getModel();
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const now = Date.now();
      if (now - lastInferAt.value < INFER_INTERVAL_MS) return; // ← gate first
      lastInferAt.value = now;
      if (model == null) return;
      try {
        const r = resize(frame, {
          scale: { width: 192, height: 192 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const outs = model.runSync([new Uint8Array(r)]);
        const out = outs[0];
        const ts = Date.now();
        const orient = frame.orientation;
        // MoveNet always outputs Float32 (51 values: 17 kps × 3).
        // Fast path avoids extra allocation for the common case.
        if (out instanceof Float32Array) {
          runOnJS(Array.from(out), 'f32', ts, orient);
        } else if (out instanceof ArrayBuffer) {
          runOnJS(Array.from(new Float32Array(out)), 'f32', ts, orient);
        } else if (out instanceof Uint8Array) {
          runOnJS(Array.from(out), 'u8', ts, orient);
        } else if (out instanceof Int8Array) {
          runOnJS(Array.from(out), 'i8', ts, orient);
        }
      } catch {
        // worklet must never throw to caller
      }
    },
    [model, resize, runOnJS, lastInferAt],
  );

  // ── State machine (100 ms tick) ────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const stage = flowRef.current;
      const last = poseRef.current;
      const valid =
        last != null &&
        (stage === 'search' || stage === 'detected'
          ? isPoseValid(last)
          : isPoseStableForLiftTracking(last));
      if (stage === 'search') {
        if (valid) {
          searchValidStreakRef.current += 1;
          if (searchValidStreakRef.current >= SEARCH_VALID_STREAK) {
            searchValidStreakRef.current = 0;
            detectedInvalidStreakRef.current = 0;
            setFlow('detected');
          }
        } else {
          /* One-off low-confidence frame doesn’t wipe progress (common with ankles in side view). */
          searchValidStreakRef.current = Math.max(0, searchValidStreakRef.current - 1);
        }
      } else if (stage === 'detected') {
        if (!valid) {
          detectedInvalidStreakRef.current += 1;
          if (detectedInvalidStreakRef.current >= DETECTED_INVALID_STREAK_TO_LEAVE) {
            detectedInvalidStreakRef.current = 0;
            searchValidStreakRef.current = 0;
            setFlow('search');
          }
        } else {
          detectedInvalidStreakRef.current = 0;
        }
      } else if (stage === 'active') {
        if (!valid) {
          poseInvalidStreakRef.current += 1;
          poseRecoverStreakRef.current = 0;
          if (poseInvalidStreakRef.current >= POSE_LOST_INVALID_STREAK) {
            poseInvalidStreakRef.current = 0;
            setFlow('pose_lost');
          }
        } else {
          poseInvalidStreakRef.current = 0;
        }
      } else if (stage === 'pose_lost') {
        if (valid) {
          poseRecoverStreakRef.current += 1;
          if (poseRecoverStreakRef.current >= POSE_RECOVER_VALID_STREAK) {
            poseRecoverStreakRef.current = 0;
            setFlow('active');
          }
        } else {
          poseRecoverStreakRef.current = 0;
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // 7B → countdown after HOLD_MS
  useEffect(() => {
    if (flow !== 'detected') return;
    const t = setTimeout(() => setFlow('countdown'), HOLD_MS);
    return () => clearTimeout(t);
  }, [flow]);

  // countdown 3→0→active
  useEffect(() => {
    if (flow !== 'countdown') return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setFlow('active'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [flow]);

  /**
   * Reset rep FSM when entering active from countdown — not after `pose_lost` recover
   * (those transitions would wipe setup/lockout progress and strand reps at zero).
   */
  useEffect(() => {
    if (flow === 'active') {
      if (!activeEnteredRef.current) {
        activeEnteredRef.current = true;
        repPhaseRef.current = 'need_setup';
        setupStreakRef.current = 0;
        lockoutStreakRef.current = 0;
        barFloorBaselineRef.current = null;
        coachCueRef.current = 'SETTING_UP';
        barPeakYSetupRef.current = 0;
        deepestSetupHipYRef.current = 0;
        armedDeepHipYRef.current = 0;
      }
    } else if (flow !== 'pose_lost') {
      activeEnteredRef.current = false;
    }
  }, [flow]);

  const requestCamAccess = useCallback(async () => {
    await Camera.requestCameraPermission();
    await requestPermission();
  }, [requestPermission]);

  const openCameraSettings = useCallback(() => void Linking.openSettings(), []);

  /** Native still enumerating Chrome stack (rare); avoid showing "no camera" flash. */
  const cameraPrep =
    cameraGranted && device == null && allDevices.length === 0 ? 'warming' : 'none';

  // ── Derived values ─────────────────────────────────────────────────────────
  const showStop = flow === 'active' || flow === 'pose_lost';
  const useFrame = modelReady && !useMock;

  const poseValid = uiPose != null && isPoseValid(uiPose);
  const skColor =
    flow === 'pose_lost'
      ? colors.skeleton_muted_v3
      : flow === 'search' && !poseValid
        ? colors.skeleton_muted_v3
        : colors.primary_green;

  const arcDash = `${(countdown / 3) * RING_C} ${RING_C}`;
  /** Minutes without leading-zero padding (“0:05” instead of “00:05”). */
  const elapsedClock = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;
  const topPad = insets.top + 8;
  /** Full-width banners (POSE LOST, dev chip): below scrim + header so they never cover controls. */
  const belowHeaderBannerTop =
    topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN + 12;
  const muteFabBottom =
    showStop
      ? insets.bottom + MUTE_FAB_ABOVE_STATS + MUTE_FAB_RAISE
      : Math.max(insets.bottom, 8) + 24 + MUTE_FAB_RAISE + MUTE_FAB_CLEAR_HUD;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root} onLayout={onLayout}>

      {/* ── Camera feed ── */}
      {cameraGranted && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused}
          format={format}
          resizeMode="contain"
          frameProcessor={useFrame ? frameProcessor : undefined}
          androidPreviewViewType="surface-view"
          outputOrientation="preview"
          pixelFormat="yuv"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCamera]}>
          {!cameraGranted ? (
            <>
              <Text style={styles.noCamTxt}>Camera permission is required for live analysis.</Text>
              <Text style={styles.noCamSub}>
                If you tapped “Don&apos;t allow” before, allow it from system settings for RepRight.
              </Text>
              {permissionStatus === 'denied' || permissionStatus === 'restricted' ? (
                <PrimaryButton title="Open app settings" onPress={openCameraSettings} />
              ) : (
                <PrimaryButton title="Allow camera access" onPress={() => void requestCamAccess()} />
              )}
            </>
          ) : cameraPrep === 'warming' ? (
            <Text style={styles.noCamTxt}>Opening camera...</Text>
          ) : (
            <>
              <Text style={styles.noCamTxt}>No camera available.</Text>
              <Text style={styles.noCamSub}>Try flipping front/back ({useFront ? 'front' : 'rear'}) or restart the session.</Text>
              <PrimaryButton title="Flip camera" onPress={() => setUseFront((v) => !v)} />
            </>
          )}
        </View>
      )}

      {/* ── Skeleton overlay ── */}
      {uiPose && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkeletonOverlay
            width={layout.w}
            height={layout.h}
            containRect={previewContain}
            keypoints={uiPose.keypoints}
            lineColor={skColor}
            pointColor={skColor}
            dynamicColors={true}
            groupTriggerScore={0.22}
          />
        </View>
      )}

      {/* ── Top gradient scrim ── */}
      <View style={[styles.topScrim, { height: topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN }]} pointerEvents="none" />

      {/* ── Top bar: back · centered title rail · flip camera only ── */}
      <View style={styles.headerBar} pointerEvents="box-none">
        {/* Title paints first; row + buttons on top so Ionicons isn’t covered by the title strip */}
        <View
          pointerEvents="none"
          style={[
            styles.headerTitleRail,
            {
              top: topPad + HEADER_CONTROLS_EXTRA_DOWN,
              left: HEADER_TITLE_RAIL_H_INSET,
              right: HEADER_TITLE_RAIL_H_INSET,
            },
          ]}
        >
          <Text style={styles.topTitle} numberOfLines={2}>
            DEADLIFT · SET 1
          </Text>
        </View>
        <View style={[styles.headerRow, { marginTop: topPad + HEADER_CONTROLS_EXTRA_DOWN }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn}>
            <SvgChevronBack color={colors.text_primary} size={22} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={useFront ? 'Use rear camera' : 'Use front camera'}
            onPress={() => setUseFront((v) => !v)}
            style={styles.circleBtn}
          >
            <SvgCameraReverseOutline color={colors.text_primary} size={22} />
          </Pressable>
        </View>
      </View>

      {/* ── 7A — Positioning ── */}
      {flow === 'search' && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <Text style={styles.searchingLbl}>SEARCHING FOR POSE...</Text>
          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, d1Style]} />
            <Animated.View style={[styles.dot, d2Style]} />
            <Animated.View style={[styles.dot, d3Style]} />
          </View>
          <View style={[styles.infoBanner, styles.searchAlertBelowSearching]}>
            <SvgHudWalkPerson color={colors.text_secondary} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>GET IN POSITION</Text>
              <Text style={styles.infoBannerBody}>
                Stand sideways to the camera. Make sure your full body is in frame.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── 7B — Detected ── */}
      {flow === 'detected' && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <View style={[styles.infoBanner, styles.infoBannerGreen]}>
            <SvgHudCheckCircle color={colors.primary_green} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerTitle, { color: colors.primary_green }]}>
                POSITION OK
              </Text>
              <Text style={styles.infoBannerBody}>Hold still...</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── 7C — Countdown ── */}
      {flow === 'countdown' && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <View style={styles.ringWrap}>
            <Svg width={RING_SZ} height={RING_SZ}>
              <G transform={`rotate(-90 ${RING_SZ / 2} ${RING_SZ / 2})`}>
                <Circle
                  cx={RING_SZ / 2}
                  cy={RING_SZ / 2}
                  r={RING_R}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={10}
                  fill="none"
                />
                <Circle
                  cx={RING_SZ / 2}
                  cy={RING_SZ / 2}
                  r={RING_R}
                  stroke={colors.primary_green}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={arcDash}
                />
              </G>
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.countNum}>{countdown > 0 ? String(countdown) : ''}</Text>
            </View>
          </View>
          <Text style={styles.getReadyTxt}>GET READY TO LIFT</Text>
        </View>
      )}

      {/* ── 7D — Pose lost banner (below header scrim; was overlapping back / title) ── */}
      {flow === 'pose_lost' && (
        <View style={[styles.topBannerAbs, { top: belowHeaderBannerTop, zIndex: 12 }]} pointerEvents="none">
          <View style={[styles.infoBanner, styles.infoBannerAmber]}>
            <SvgHudWarnTriangle color={colors.accent_yellow} size={22} />
            <Text style={[styles.infoBannerTitle, { color: colors.accent_yellow }]}>
              POSE LOST — REPOSITION
            </Text>
          </View>
        </View>
      )}

      {/* ── Stats panel + STOP SESSION ── */}
      {showStop && (
        <View style={styles.statsPanel}>
          {/* Status pill */}
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusTxt}>TRACKING DEADLIFT</Text>
          </View>

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <StatCard label="REP" value={String(reps)} />
            <StatCard label="SERIES" value="1" />
            <StatCard label="TIME" value={elapsedClock} green />
          </View>

          <PrimaryButton
            title="STOP SESSION"
            variant="danger"
            onPress={() => setShowStopModal(true)}
            style={styles.stopBtn}
          />
        </View>
      )}

      {/* ── Voice mute (bottom‑right FAB) ── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={audioOn ? 'Mute voice feedback' : 'Unmute voice feedback'}
        onPress={() => setAudioOn((v) => !v)}
        style={[
          styles.muteFab,
          { bottom: muteFabBottom, right: Math.max(insets.right, 12) + 6 },
        ]}
      >
        {audioOn ? (
          <SvgVolumeOn key="vol-on" color={colors.text_primary} size={22} />
        ) : (
          <SvgVolumeMuted key="vol-mute" color={colors.text_primary} size={22} />
        )}
      </Pressable>

      {/* ── Stop session modal ── */}
      {showStopModal && (
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStopModal(false)}
        >
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalWarnIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>End Session?</Text>
            <Text style={styles.modalBody}>
              Your progress will be saved up to this point, but the current set will not be recorded.
            </Text>
            <View style={styles.modalSummaryBox}>
              <Text style={styles.modalSummaryMain}>
                SET 1 · {reps} REPS · {elapsedClock}
              </Text>
              <Text style={styles.modalSummaryGreen}>Completed sets are safe.</Text>
            </View>
            <Pressable
              style={styles.modalKeepBtn}
              onPress={() => setShowStopModal(false)}
            >
              <Text style={styles.modalKeepTxt}>KEEP GOING</Text>
            </Pressable>
            <Pressable
              style={styles.modalEndBtn}
              onPress={() => {
                void Speech.stop();
                navigation.navigate('SessionComplete');
              }}
            >
              <Text style={styles.modalEndTxt}>END SESSION</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* ── Dev badge ── */}
      {__DEV__ && useMock && (
        <View style={[styles.devChip, { top: belowHeaderBannerTop }]} pointerEvents="none">
          <Text style={styles.devChipTxt}>MOCK</Text>
        </View>
      )}
    </View>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <View style={cardStyles.card}>
      <Text style={[cardStyles.val, green && { color: colors.primary_green }]}>{value}</Text>
      <Text style={cardStyles.lab}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  val: {
    fontFamily: typography.fontFamily.display,
    fontSize: 40,
    color: colors.text_primary,
    lineHeight: 46,
  },
  lab: {
    marginTop: 4,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps,
    color: colors.text_muted,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  noCamera: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg_v3,
    paddingHorizontal: 24,
    gap: 16,
  },
  noCamTxt: {
    color: colors.text_secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
  },
  noCamSub: {
    color: colors.text_muted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: typography.fontFamily.regular,
    marginBottom: 4,
  },

  // Scrim — darkens the top area for readability
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  // Top header — flip + back pinned; title optically centered
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 18,
    elevation: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    zIndex: 2,
    elevation: 8,
  },
  headerTitleRail: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    zIndex: 0,
  },
  muteFab: {
    position: 'absolute',
    zIndex: 20,
    elevation: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(26,25,25,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(72,72,71,0.6)',
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26,25,25,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(72,72,71,0.6)',
  },
  topTitle: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  overlayCenter: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 246,
    alignItems: 'center',
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(26,25,25,0.90)',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(72,72,71,0.5)',
  },
  infoBannerGreen: {
    backgroundColor: colors.green_subtle_bg,
    borderColor: colors.primary_green,
    borderWidth: 1,
  },
  infoBannerAmber: {
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderColor: colors.accent_yellow,
    borderWidth: 1,
  },
  infoBannerTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 3,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  infoBannerBody: {
    marginTop: 4,
    color: colors.text_secondary,
    fontSize: typography.fontSize.captions,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary_green,
  },
  searchAlertBelowSearching: {
    marginTop: 20,
    width: '100%',
  },
  searchingLbl: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'center',
    color: colors.text_muted,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 1,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },

  // 7C countdown ring
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute',
    width: RING_SZ,
    height: RING_SZ,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNum: {
    color: '#fff',
    fontFamily: typography.fontFamily.display,
    fontSize: 72,
    lineHeight: 80,
  },
  getReadyTxt: {
    marginTop: 18,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWider,
    textTransform: 'uppercase',
  },

  // Absolute banners (top area, 7D states)
  topBannerAbs: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  errorBannerAbs: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerLabel: {
    fontSize: typography.fontSize.captionCaps,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  errorBannerMsg: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodyLg,
  },

  // Stats panel
  statsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.nav_bar_bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(39,195,79,0.10)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(39,195,79,0.30)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary_green,
  },
  statusTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 1,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  stopBtn: { marginTop: 14 },

  // Stop session modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '88%',
    backgroundColor: colors.surface_v3,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalWarnIcon: { fontSize: 38, marginBottom: 10 },
  modalTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm,
    color: colors.text_primary,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  modalSummaryBox: {
    backgroundColor: colors.bg_high,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  modalSummaryMain: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: 14,
    letterSpacing: 1,
  },
  modalSummaryGreen: {
    marginTop: 4,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary_green,
    fontSize: 12,
  },
  modalKeepBtn: {
    backgroundColor: colors.bg_high,
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalKeepTxt: {
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontSize: 14,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  modalEndBtn: {
    backgroundColor: colors.accent_red,
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalEndTxt: {
    fontFamily: typography.fontFamily.display,
    color: '#fff',
    fontSize: 14,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },

  // Dev
  devChip: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(255,184,0,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent_yellow,
  },
  devChipTxt: {
    color: colors.accent_yellow,
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 1,
  },
});
