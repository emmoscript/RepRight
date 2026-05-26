import { useIsFocused, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { FramingGuideOverlay } from '@/components/FramingGuideOverlay';
import { SkeletonOverlay } from '@/components/SkeletonOverlay';
import {
  getModel,
  getMockPose,
  initModel,
  KEYPOINTS,
  keypointsFromMovenetOutput,
  type PoseResult,
} from '@/modules/movenet';
import { analyzePose } from '@/modules/analyzer';
import { generateFeedback } from '@/modules/feedback';
import { sessionTrace } from '@/modules/sessionTrace';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { barbellProxyFromWrists } from '@/utils/barbellProxy';
import type { DeadliftFormCue } from '@/utils/deadliftPhase';
import { inferDeadliftFormCue, lateralHipHingeDegrees } from '@/utils/deadliftPhase';
import {
  DEADLIFT_REP_THRESH,
  hipsReliableForRepCount,
  primaryHipY,
  smoothHipY,
  standingHipYFromBaseline,
} from '@/utils/deadliftRep';
import { alignPoseToPortraitOverlay } from '@/utils/orientPose';
import { framingHintFromPose } from '@/utils/framingGuide';
import { getSetTarget } from '@/utils/setPlan';
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
/** Brief pause after last planned rep so the counter/UI updates before navigating away. */
const AUTO_FINISH_TARGET_REPS_DELAY_MS = 900;
/** Hold lockout (after a counted rep) this long to auto-finish without tapping FINISH SET. */
const LOCKOUT_IDLE_FINISH_MS = 4500;
/** Extra slack on lockoutTopY for idle detection (smoothed hip Y lags slightly). */
const LOCKOUT_IDLE_SLACK = 0.012;

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
/** Fallback strip height before first `onLayout` (pill + cards + STOP + padding). */
const STATS_PANEL_HEIGHT_EST = 226;
/** Mute FAB height — keep in sync with `styles.muteFab`. */
const MUTE_FAB_HEIGHT = 52;
/** Gap between tracking panel top edge and mute FAB bottom (anchored to modal). */
const MUTE_GAP_ABOVE_TRACKING_PANEL = 10;
/** Gap between FAB top and bottom edge of form-feedback banner. */
const FORM_FEEDBACK_GAP_ABOVE_FAB = 8;
/** Push header controls down from status bar to clear camera letterboxing. */
const HEADER_CONTROLS_EXTRA_DOWN = 14;
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
  const route = useRoute<RouteProp<RootStackParamList, 'LiveSession'>>();
  const continuedWorkout = route.params?.continuedWorkout === true;
  const isFocused = useIsFocused();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clearResults = useSessionResultStore((s) => s.clear);
  const setStarted = useSessionResultStore((s) => s.setStartedAt);
  const setLastSetSummary = useSessionResultStore((s) => s.setLastSetSummary);
  const addErrors = useSessionResultStore((s) => s.addErrors);
  const currentSetNumber = useSessionResultStore((s) => s.currentSetNumber);
  const plannedSetCount = useSessionConfigStore((s) => s.setCount);
  const customSetPlan = useSessionConfigStore((s) => s.customSetPlan);
  const repsPerSet = useSessionConfigStore((s) => s.repsPerSet);
  const weightAmount = useSessionConfigStore((s) => s.weightAmount);
  const setPlans = useSessionConfigStore((s) => s.setPlans);
  const weightUnit = useSessionConfigStore((s) => s.weightUnit);
  const setTarget = useMemo(
    () =>
      getSetTarget(
        { customSetPlan, setCount: plannedSetCount, repsPerSet, weightAmount, setPlans },
        currentSetNumber,
      ),
    [customSetPlan, plannedSetCount, repsPerSet, weightAmount, setPlans, currentSetNumber],
  );
  const targetRepsForSet = setTarget.reps;
  const setWeightAmount = setTarget.weightAmount;

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
  const repsRef = useRef(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** Full-workout quit (discard in-progress); not used for finishing the current set. */
  const [showQuitWorkoutModal, setShowQuitWorkoutModal] = useState(false);
  /** Measured height of bottom tracking strip — mute FAB anchors just above panel top. */
  const [trackingStripHeight, setTrackingStripHeight] = useState(0);

  const onTrackingStripLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackingStripHeight(e.nativeEvent.layout.height);
  }, []);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const flowRef = useRef<Flow>('search');
  const searchValidStreakRef = useRef(0);
  const detectedInvalidStreakRef = useRef(0);
  const poseInvalidStreakRef = useRef(0);
  const poseRecoverStreakRef = useRef(0);
  const repPhaseRef = useRef<'need_return' | 'need_setup' | 'need_lockout'>('need_setup');
  const setupStreakRef = useRef(0);
  const lockoutStreakRef = useRef(0);
  const returnStreakRef = useRef(0);
  const activeEnteredRef = useRef(false);
  const poseRef = useRef<PoseResult | null>(null);
  const historyRef = useRef<PoseResult[]>([]);
  const sessionStartRef = useRef(0);
  /** Dev: log raw tensor landmark sample once after countdown (avoid spam before lift starts). */
  const didLogOnce = useRef(false);
  /** Dev: log VisionCamera orientation after countdown only when it changes. */
  const lastLoggedOrientation = useRef<string>('');
  const prevFlowTraceRef = useRef<Flow>('search');
  const inferCountRef = useRef(0);
  const inferWindowStartRef = useRef(0);
  /** Wrist-proxy “floor” at end of setup (max Y near shins)—not latched when standing tall at session start. */
  const barFloorBaselineRef = useRef<number | null>(null);
  /** Tracks deepest bar proxy (max Y) while arming setup for current rep cycle. */
  const barPeakYSetupRef = useRef(0);
  /** Deepest hip Y while arming setup (max Y in portrait). */
  const deepestSetupHipYRef = useRef(0);
  /** Snapshot of deepest hip Y when switching to need_lockout (ascent requires this floor). */
  const armedDeepHipYRef = useRef(0);
  const coachCueRef = useRef<DeadliftFormCue>('UNKNOWN');
  /** Standing hip Y (median) sampled right after countdown — rep gates are relative to this. */
  const standingHipYRef = useRef<number | null>(null);
  const baselineHipSamplesRef = useRef<number[]>([]);
  const lastRepAtRef = useRef(0);
  const armedAtRef = useRef(0);
  const hipSmoothRef = useRef<number | null>(null);
  /** False after COUNT until hips descend past returnGate — blocks re-arm at lockout height. */
  const setupArmingEnabledRef = useRef(true);
  const lastCountAtRef = useRef(0);
  const autoFinishScheduledRef = useRef(false);
  const autoFinishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockoutIdleStartRef = useRef<number | null>(null);
  const plannedRepsPerSetRef = useRef(targetRepsForSet);
  const finishCurrentSetRef = useRef<() => void>(() => {});
  const scheduleAutoFinishRef = useRef<(reason: 'target_reps' | 'lockout_idle', delayMs: number) => void>(
    () => {},
  );
  /** Biomechanical cue streak → banner after stable detection (with modal gate). */
  const formErrStreakRef = useRef(0);
  /** Audio throttle for `generateFeedback` (max 1 cue / 2s in feedback module). */
  const lastFormAudioAtRef = useRef(0);
  /** One `addErrors` per `errorId` per session (summary / Session Complete). */
  const recordedFormErrIdsRef = useRef<Set<string>>(new Set());
  const showQuitModalRef = useRef(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [uiPose, setUiPose] = useState<PoseResult | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [liveFormBanner, setLiveFormBanner] = useState<{
    message: string;
    backgroundColor: string;
    textColor: string;
    severity: 'critical' | 'warning';
  } | null>(null);

  // ── Shared value for frame-processor throttle (accessible from worklet) ────
  const lastInferAt = useSharedValue(0);

  // ── Pulsing dot animations (7A search state) ────────────────────────────────
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);
  const d1Style = useAnimatedStyle(() => ({ opacity: d1.value }));
  const d2Style = useAnimatedStyle(() => ({ opacity: d2.value }));
  const d3Style = useAnimatedStyle(() => ({ opacity: d3.value }));

  /** Keep flowRef in sync before paint — infer callbacks shouldn’t lag one frame behind `active`. */
  useLayoutEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  useEffect(() => {
    if (prevFlowTraceRef.current !== flow) {
      sessionTrace.flow(prevFlowTraceRef.current, flow);
      prevFlowTraceRef.current = flow;
      if (flow === 'active' && activeEnteredRef.current) {
        sessionTrace.session('lift_resumed', { mock: useMock });
      } else if (flow === 'active') {
        sessionTrace.session('lift_started', { mock: useMock, continued: continuedWorkout });
        inferCountRef.current = 0;
        inferWindowStartRef.current = Date.now();
      }
    }
  }, [flow, useMock, continuedWorkout]);

  /** Dev: allow one-shot tensor log again after leaving this screen. */
  useEffect(() => {
    if (isFocused) return;
    didLogOnce.current = false;
    lastLoggedOrientation.current = '';
  }, [isFocused]);

  useEffect(() => {
    plannedRepsPerSetRef.current = targetRepsForSet;
  }, [targetRepsForSet]);

  const clearAutoFinishTimers = useCallback(() => {
    autoFinishScheduledRef.current = false;
    lockoutIdleStartRef.current = null;
    if (autoFinishTimeoutRef.current != null) {
      clearTimeout(autoFinishTimeoutRef.current);
      autoFinishTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoFinish = useCallback((reason: 'target_reps' | 'lockout_idle', delayMs: number) => {
    if (autoFinishScheduledRef.current || showQuitModalRef.current) return;
    autoFinishScheduledRef.current = true;
    lockoutIdleStartRef.current = null;
    sessionTrace.session('auto_finish_scheduled', { reason, delayMs, reps: repsRef.current });
    if (autoFinishTimeoutRef.current != null) clearTimeout(autoFinishTimeoutRef.current);
    autoFinishTimeoutRef.current = setTimeout(() => {
      autoFinishTimeoutRef.current = null;
      sessionTrace.session('auto_finish', { reason, reps: repsRef.current });
      finishCurrentSetRef.current();
    }, delayMs);
  }, []);

  useEffect(() => {
    scheduleAutoFinishRef.current = scheduleAutoFinish;
  }, [scheduleAutoFinish]);

  useEffect(() => () => clearAutoFinishTimers(), [clearAutoFinishTimers]);

  useEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  const finishCurrentSet = useCallback(() => {
    clearAutoFinishTimers();
    void Speech.stop();
    setLastSetSummary(reps, elapsedSec);
    navigation.navigate('SessionComplete');
  }, [reps, elapsedSec, navigation, setLastSetSummary, clearAutoFinishTimers]);

  useEffect(() => {
    finishCurrentSetRef.current = finishCurrentSet;
  }, [finishCurrentSet]);

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    showQuitModalRef.current = showQuitWorkoutModal;
  }, [showQuitWorkoutModal]);

  useEffect(() => {
    if (!audioOn) void Speech.stop();
  }, [audioOn]);

  useEffect(() => {
    if (showQuitWorkoutModal) setLiveFormBanner(null);
  }, [showQuitWorkoutModal]);

  useEffect(() => {
    if (flow === 'pose_lost') setLiveFormBanner(null);
  }, [flow]);

  useEffect(() => {
    const tracking = flow === 'active' || flow === 'pose_lost';
    if (!tracking) setTrackingStripHeight(0);
  }, [flow]);

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
    if (!continuedWorkout) {
      clearResults();
      setStarted(Date.now());
    }
    setReps(0);
    setElapsedSec(0);
    recordedFormErrIdsRef.current = new Set();
    lastFormAudioAtRef.current = 0;
  }, [continuedWorkout, clearResults, setStarted]);

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
      sessionTrace.model(ready ? 'ready' : 'unavailable', { ok, ready });
      if (__DEV__ && !ready) sessionTrace.model('mock_fallback');
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

  // ── Pose ingestion: reps via hip Y + optional biomechanical banner (active only). ─
  const ingestPose = useCallback((pose: PoseResult) => {
    poseRef.current = pose;
    const h = historyRef.current;
    h.push(pose);
    if (h.length > 8) h.shift();
    setUiPose(pose);

    const stage = flowRef.current;
    const hipY = primaryHipY(pose);
    const poseValidNow =
      stage === 'search' || stage === 'detected' ? isPoseValid(pose) : isPoseStableForLiftTracking(pose);

    if (stage === 'active' || stage === 'pose_lost') {
      const lh = pose.keypoints[KEYPOINTS.LEFT_HIP]?.score;
      const lk = pose.keypoints[KEYPOINTS.LEFT_KNEE]?.score;
      const la = pose.keypoints[KEYPOINTS.LEFT_ANKLE]?.score;
      sessionTrace.poseSample(stage, {
        hipY,
        repPhase: repPhaseRef.current,
        reps: repsRef.current,
        valid: poseValidNow,
        lh,
        lk,
        la,
      });
    }

    if (stage === 'active') {
      const bar = barbellProxyFromWrists(pose);

      let displacement = 0;
      const rawY = hipY;
      const y =
        rawY != null
          ? (hipSmoothRef.current = smoothHipY(hipSmoothRef.current, rawY))
          : null;
      const repPhaseBefore = repPhaseRef.current;

      if (repPhaseRef.current === 'need_setup') {
        const setupBarGate =
          standingHipYRef.current != null
            ? standingHipYRef.current + DEADLIFT_REP_THRESH.setupDropBelowStanding * 0.85
            : null;
        if (bar != null && y != null && (setupBarGate == null || y > setupBarGate)) {
          barPeakYSetupRef.current = Math.max(barPeakYSetupRef.current, bar.y);
        }
      }

      const floorY = barFloorBaselineRef.current;
      if (bar && floorY != null) displacement = Math.max(0, floorY - bar.y);

      const hingeDeg = lateralHipHingeDegrees(pose);
      if (hingeDeg != null) {
        coachCueRef.current = inferDeadliftFormCue(hingeDeg, displacement, displacement < 0.06);
      }

      if (y != null && standingHipYRef.current != null) {
        const stand = standingHipYRef.current;
        const bottomGate = stand + DEADLIFT_REP_THRESH.setupDropBelowStanding;
        const lockoutTopY = stand + DEADLIFT_REP_THRESH.lockoutStandingSlack;
        const returnGate = stand + DEADLIFT_REP_THRESH.returnToStandingMargin;
        const returnGlitchY = stand + DEADLIFT_REP_THRESH.returnGlitchMaxAboveStanding;
        const rearmMaxY = stand + DEADLIFT_REP_THRESH.lockoutRearmMaxAboveStanding;

        if (repPhaseRef.current === 'need_return') {
          setupStreakRef.current = 0;
          lockoutStreakRef.current = 0;
          if (y > returnGlitchY) {
            returnStreakRef.current = 0;
          } else if (y >= returnGate) {
            returnStreakRef.current += 1;
            if (returnStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveReturnFrames) {
              repPhaseRef.current = 'need_setup';
              returnStreakRef.current = 0;
              setupArmingEnabledRef.current = false;
              sessionTrace.repPhase(repPhaseBefore, 'need_setup', {
                hipY: y,
                standing: stand,
                returnGate,
                bottomGate,
              });
            }
          } else {
            returnStreakRef.current = 0;
          }
        } else if (repPhaseRef.current === 'need_setup') {
          if (y >= returnGate && y <= returnGlitchY) {
            setupArmingEnabledRef.current = true;
          }
          if (setupArmingEnabledRef.current && y > bottomGate) {
            deepestSetupHipYRef.current = Math.max(deepestSetupHipYRef.current, y);
            setupStreakRef.current += 1;
            lockoutStreakRef.current = 0;
            if (setupStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveSetupFrames) {
              const armedCandidate = deepestSetupHipYRef.current;
              const minDeep =
                bottomGate + DEADLIFT_REP_THRESH.minBottomClearanceBeyondGate;
              const sinceCount = Date.now() - lastCountAtRef.current;
              const postCountShallow =
                sinceCount < DEADLIFT_REP_THRESH.postCountShallowArmBlockMs &&
                armedCandidate <
                  bottomGate + DEADLIFT_REP_THRESH.postCountMinArmDepthBeyondGate;
              if (armedCandidate < minDeep || postCountShallow) {
                setupStreakRef.current = 0;
                deepestSetupHipYRef.current = 0;
              } else {
              armedDeepHipYRef.current = armedCandidate;
              deepestSetupHipYRef.current = 0;
              repPhaseRef.current = 'need_lockout';
              setupStreakRef.current = 0;
              armedAtRef.current = Date.now();
              sessionTrace.repPhase(repPhaseBefore, 'need_lockout', {
                hipY: y,
                armed: armedDeepHipYRef.current,
                standing: stand,
                bottomGate,
                minDeep,
                lockoutTopY,
              });
              const peak = barPeakYSetupRef.current;
              if (peak > 0) {
                barFloorBaselineRef.current = peak;
              } else if (bar != null) {
                barFloorBaselineRef.current = bar.y;
              }
              barPeakYSetupRef.current = 0;
              }
            }
          } else {
            setupStreakRef.current = Math.max(0, setupStreakRef.current - 1);
            if (setupStreakRef.current === 0) {
              barPeakYSetupRef.current = 0;
              deepestSetupHipYRef.current = 0;
            }
          }
        } else {
          const deep = armedDeepHipYRef.current;
          if (
            y > bottomGate &&
            y <= rearmMaxY &&
            deep > 0 &&
            y > deep + DEADLIFT_REP_THRESH.lockoutRearmMinDrop
          ) {
            armedDeepHipYRef.current = Math.max(deep, y);
            armedAtRef.current = Date.now();
            lockoutStreakRef.current = 0;
            sessionTrace.rep('rearm', {
              hipY: y,
              armed: armedDeepHipYRef.current,
              prevDeep: deep,
            });
          }
          const armedDeep = armedDeepHipYRef.current;
          const ascent = armedDeep > 0 ? armedDeep - y : 0;
          const bottomOk = armedDeep >= bottomGate + DEADLIFT_REP_THRESH.minBottomClearanceBeyondGate;
          const armAgeMs = Date.now() - armedAtRef.current;
          const hipsOk = hipsReliableForRepCount(pose);

          if (armAgeMs > DEADLIFT_REP_THRESH.maxLockoutWaitMs) {
            lockoutStreakRef.current = 0;
            armedDeepHipYRef.current = 0;
            armedAtRef.current = 0;
            repPhaseRef.current = 'need_setup';
            setupArmingEnabledRef.current = false;
            sessionTrace.rep('stale_reset', { armAgeMs, hipY: y });
          } else {
          const romComplete = ascent >= DEADLIFT_REP_THRESH.repRomCompleteNorm;
          const atLockoutHeight = y <= lockoutTopY;
          const armAgeOk =
            armAgeMs >= DEADLIFT_REP_THRESH.minMsFromArmToCount &&
            armAgeMs <= DEADLIFT_REP_THRESH.maxArmAgeForCount;
          const canCountFrame = poseValidNow && hipsOk && armAgeOk;
          if (
            canCountFrame &&
            bottomOk &&
            romComplete &&
            atLockoutHeight
          ) {
            lockoutStreakRef.current += 1;
            setupStreakRef.current = 0;
            if (lockoutStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveLockoutFrames) {
              const now = Date.now();
              if (now - lastRepAtRef.current >= DEADLIFT_REP_THRESH.minMsBetweenReps) {
                lastRepAtRef.current = now;
                lastCountAtRef.current = now;
                lockoutStreakRef.current = 0;
                armedDeepHipYRef.current = 0;
                armedAtRef.current = 0;
                returnStreakRef.current = 0;
                setupArmingEnabledRef.current = false;
                repPhaseRef.current = 'need_return';
                setReps((r) => {
                  const next = r + 1;
                  sessionTrace.rep('COUNT', {
                    reps: next,
                    hipY: y,
                    rawHipY: rawY,
                    armedWas: armedDeep,
                    standing: stand,
                    lockoutTopY,
                    ascent,
                    armAgeMs,
                  });
                  if (next >= plannedRepsPerSetRef.current) {
                    scheduleAutoFinishRef.current('target_reps', AUTO_FINISH_TARGET_REPS_DELAY_MS);
                  }
                  return next;
                });
                void impactAsync(ImpactFeedbackStyle.Medium);
              } else {
                lockoutStreakRef.current = 0;
              }
            }
          } else {
            lockoutStreakRef.current = 0;
          }
          }
        }

        if (
          !autoFinishScheduledRef.current &&
          repsRef.current >= 1 &&
          repPhaseRef.current === 'need_return' &&
          y != null &&
          standingHipYRef.current != null &&
          poseValidNow
        ) {
          const idleLockoutTopY =
            standingHipYRef.current + DEADLIFT_REP_THRESH.lockoutStandingSlack;
          const atLockout = y <= idleLockoutTopY + LOCKOUT_IDLE_SLACK;
          if (atLockout) {
            if (lockoutIdleStartRef.current == null) {
              lockoutIdleStartRef.current = Date.now();
            } else if (Date.now() - lockoutIdleStartRef.current >= LOCKOUT_IDLE_FINISH_MS) {
              scheduleAutoFinishRef.current('lockout_idle', 350);
            }
          } else {
            lockoutIdleStartRef.current = null;
          }
        } else if (repPhaseRef.current !== 'need_return') {
          lockoutIdleStartRef.current = null;
        }
      } else if (y != null && standingHipYRef.current == null) {
        hipSmoothRef.current = y;
        baselineHipSamplesRef.current.push(y);
        if (baselineHipSamplesRef.current.length >= DEADLIFT_REP_THRESH.baselineFrameCount) {
          standingHipYRef.current = standingHipYFromBaseline(baselineHipSamplesRef.current);
          sessionTrace.rep('baseline', { standing: standingHipYRef.current });
        }
      } else if (repPhaseRef.current === 'need_lockout') {
        lockoutStreakRef.current = 0;
      }
    }

      if (stage === 'active' && !showQuitModalRef.current) {
      const analysis = analyzePose(pose, historyRef.current.slice(-16));
      if (analysis.errors.length > 0) {
        formErrStreakRef.current += 1;
        sessionTrace.analyzer(
          analysis.phase,
          analysis.errors.map((e) => e.errorId),
        );
      } else formErrStreakRef.current = 0;

      const fb = generateFeedback(analysis, lastFormAudioAtRef.current);
      const showBn =
        formErrStreakRef.current >= 3 && fb.activeBanner != null && !showQuitModalRef.current;

      if (showBn && fb.topError && !recordedFormErrIdsRef.current.has(fb.topError.errorId)) {
        recordedFormErrIdsRef.current.add(fb.topError.errorId);
        addErrors([fb.topError]);
        if (fb.topError.severity === 'critical') {
          void impactAsync(ImpactFeedbackStyle.Medium);
        }
      }

      if (showBn && fb.audioMessage && audioOnRef.current) {
        Speech.speak(fb.audioMessage);
        lastFormAudioAtRef.current = Date.now();
      }

      setLiveFormBanner((prev) => {
        if (formErrStreakRef.current === 0) return null;
        if (!showBn || !fb.activeBanner) return prev;
        const next = {
          message: fb.activeBanner.message,
          backgroundColor: fb.activeBanner.backgroundColor,
          textColor: fb.activeBanner.textColor,
          severity: fb.activeBanner.severity,
        };
        if (
          prev?.message === next.message &&
          prev?.backgroundColor === next.backgroundColor &&
          prev?.severity === next.severity
        ) {
          return prev;
        }
        return next;
      });
    }
  }, [addErrors]);

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
      // Tensor + RAW logs: once per visit, only after countdown → `active` (see blur reset).
      const shouldLogInferenceBundle =
        __DEV__ && flowRef.current === 'active' && !didLogOnce.current;

      if (shouldLogInferenceBundle) {
        didLogOnce.current = true;
        sessionTrace.rawTensor(kind, values);
      }
      try {
        const liftRunning =
          flowRef.current === 'active' || flowRef.current === 'pose_lost';
        if (liftRunning) {
          inferCountRef.current += 1;
          const winMs = Date.now() - inferWindowStartRef.current;
          if (winMs >= 2500) {
            sessionTrace.inferFps((inferCountRef.current * 1000) / winMs, kind);
            inferCountRef.current = 0;
            inferWindowStartRef.current = Date.now();
          }
        }
        if (__DEV__ && liftRunning) {
          const o = String(frameOrientation);
          if (lastLoggedOrientation.current !== o) {
            lastLoggedOrientation.current = o;
            sessionTrace.infer('orientation', { orientation: o });
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
        returnStreakRef.current = 0;
        barFloorBaselineRef.current = null;
        coachCueRef.current = 'SETTING_UP';
        barPeakYSetupRef.current = 0;
        deepestSetupHipYRef.current = 0;
        armedDeepHipYRef.current = 0;
        standingHipYRef.current = null;
        baselineHipSamplesRef.current = [];
        lastRepAtRef.current = 0;
        lastCountAtRef.current = 0;
        armedAtRef.current = 0;
        hipSmoothRef.current = null;
        setupArmingEnabledRef.current = true;
        clearAutoFinishTimers();
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

  const onConfirmQuitWholeWorkout = useCallback(() => {
    void Speech.stop();
    setShowQuitWorkoutModal(false);
    clearResults();
    navigation.navigate('MainTabs', { screen: 'HomeMain' });
  }, [navigation, clearResults]);

  const topPad = insets.top + 8;
  /** Full-width banners (POSE LOST, dev chip): below scrim + header so they never cover controls. */
  const belowHeaderBannerTop =
    topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN + 12;

  /** Distance from root bottom to top of tracking strip — drives FAB so it tracks modal height. */
  const stripAnchorPx = showStop
    ? trackingStripHeight > 0
      ? trackingStripHeight
      : STATS_PANEL_HEIGHT_EST
    : 0;

  const muteFabBottom =
    showStop
      ? stripAnchorPx + MUTE_GAP_ABOVE_TRACKING_PANEL
      : Math.max(insets.bottom, 8) + 24 + MUTE_FAB_CLEAR_HUD;

  const formFeedbackDockBottom =
    stripAnchorPx +
    MUTE_GAP_ABOVE_TRACKING_PANEL +
    MUTE_FAB_HEIGHT +
    FORM_FEEDBACK_GAP_ABOVE_FAB;

  const showFramingGuide =
    flow === 'search' || flow === 'detected' || flow === 'countdown' || flow === 'pose_lost';

  const framingHint = useMemo(() => {
    if (!showFramingGuide || !uiPose) return null;
    const valid =
      flow === 'pose_lost' ? isPoseStableForLiftTracking(uiPose) : isPoseValid(uiPose);
    return framingHintFromPose(uiPose, valid);
  }, [showFramingGuide, uiPose, flow]);

  const headerScrimBottomPx = topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN;

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

      {/* ── Framing guide — below all HUD (camera alignment box only) ── */}
      <FramingGuideOverlay
        containRect={previewContain}
        topReservePx={headerScrimBottomPx}
        visible={showFramingGuide}
        hint={framingHint}
      />

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
            DEADLIFT · SET {currentSetNumber}/{plannedSetCount} · {setWeightAmount}{' '}
            {weightUnit === 'kg' ? 'KG' : 'LB'}
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

      {/* ── Positioning HUD — always above framing guide ── */}
      <View style={styles.positionHudLayer} pointerEvents="box-none">
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
                Stand sideways. Fit your full body inside the frame — tracking works best when you&apos;re centered.
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
      </View>

      {/* ── 7D — Pose lost banner (hidden while quit modal open — avoids stacking above dialog). ── */}
      {flow === 'pose_lost' && !showQuitWorkoutModal && (
        <View style={[styles.topBannerAbs, { top: belowHeaderBannerTop, zIndex: 12 }]} pointerEvents="none">
          <View style={[styles.infoBanner, styles.infoBannerAmber]}>
            <SvgHudWarnTriangle color={colors.accent_yellow} size={22} />
            <Text style={[styles.infoBannerTitle, { color: colors.accent_yellow }]}>
              POSE LOST — REPOSITION
            </Text>
          </View>
        </View>
      )}

      {/* ── Live form cues (analyzer) above strip — cleared during pose_lost / modal. ── */}
      {liveFormBanner && showStop && !showQuitWorkoutModal && flow !== 'pose_lost' && (
        <View
          pointerEvents="none"
          style={[styles.formFeedbackDock, { bottom: formFeedbackDockBottom }]}
        >
          <View
            style={[styles.formFeedbackInner, { backgroundColor: liveFormBanner.backgroundColor }]}
          >
            <SvgHudWarnTriangle color={liveFormBanner.textColor} size={22} />
            <View style={styles.formFeedbackTextCol}>
              <Text style={[styles.formFeedbackKicker, { color: liveFormBanner.textColor }]}>
                AI LIVE FEEDBACK
              </Text>
              <Text style={[styles.formFeedbackTxt, { color: liveFormBanner.textColor }]}>
                {liveFormBanner.message}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Stats panel: finish this set vs quit whole workout ── */}
      {showStop && (
        <View
          style={[styles.statsPanel, { paddingBottom: Math.max(32, insets.bottom + 14) }]}
          onLayout={onTrackingStripLayout}
        >
          {/* Status pill */}
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusTxt}>TRACKING DEADLIFT</Text>
          </View>

          {/* Stat cards */}
          <View style={styles.statsRow}>
            <StatCard label="REP" value={`${reps}/${targetRepsForSet}`} />
            <StatCard label="SERIES" value={`${currentSetNumber}/${plannedSetCount}`} />
            <StatCard label="TIME" value={elapsedClock} green />
          </View>

          <PrimaryButton
            title="FINISH SET"
            variant="primary"
            onPress={finishCurrentSet}
            style={styles.finishSetBtn}
          />

          <PrimaryButton
            title="QUIT WORKOUT"
            variant="ghost"
            onPress={() => setShowQuitWorkoutModal(true)}
            style={styles.quitWorkoutBtn}
          />
        </View>
      )}

      {/* ── Voice mute (bottom‑right FAB) — hidden while quit modal is open. ── */}
      {!showQuitWorkoutModal && (
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
      )}

      {/* ── Dev badge ── */}
      {__DEV__ && useMock && (
        <View style={[styles.devChip, { top: belowHeaderBannerTop }]} pointerEvents="none">
          <Text style={styles.devChipTxt}>MOCK</Text>
        </View>
      )}

      {/* ── Quit whole workout modal (discard in-progress session). ── */}
      {showQuitWorkoutModal && (
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowQuitWorkoutModal(false)}
        >
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalWarnIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Quit workout?</Text>
            <Text style={styles.modalBody}>
              {
                "You'll lose timers and reps for this workout draft. Stats entries you already saved are unchanged. Use FINISH SET to save the current set. Quitting resets this workout draft, including notes from prior sets you haven't exported yet."
              }
            </Text>
            <View style={styles.modalSummaryBox}>
              <Text style={styles.modalSummaryMain}>
                SET {currentSetNumber} · {setWeightAmount} {weightUnit === 'kg' ? 'KG' : 'LB'} · {reps}{' '}
                REPS · {elapsedClock}
              </Text>
            </View>
            <Pressable
              style={styles.modalKeepBtn}
              onPress={() => setShowQuitWorkoutModal(false)}
            >
              <Text style={styles.modalKeepTxt}>KEEP LIFTING</Text>
            </Pressable>
            <Pressable style={styles.modalEndBtn} onPress={onConfirmQuitWholeWorkout}>
              <Text style={styles.modalEndTxt}>QUIT WORKOUT</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
    zIndex: 14,
    elevation: 12,
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
  positionHudLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    elevation: 25,
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
    zIndex: 1,
    elevation: 12,
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
    zIndex: 16,
    elevation: 18,
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
  finishSetBtn: { marginTop: 14 },
  quitWorkoutBtn: { marginTop: 10 },

  formFeedbackDock: {
    position: 'absolute',
    left: 16,
    right: 72,
    zIndex: 15,
    elevation: 14,
  },
  formFeedbackInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  formFeedbackTextCol: { flex: 1, minWidth: 0 },
  formFeedbackKicker: {
    fontFamily: typography.fontFamily.display,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
    marginBottom: 4,
    opacity: 0.92,
  },
  formFeedbackTxt: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
    lineHeight: 20,
  },

  // Quit workout modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 28,
  },
  modalCard: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: colors.surface_v3,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    zIndex: 101,
    elevation: 30,
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
