import { useIsFocused, useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import * as Speech from 'expo-speech';
import {
  formErrorRecordKey,
  hasFormErrorRecord,
  hasFormErrorRecorded,
} from '@/utils/formBreakdown';
import { speakFeedbackMessage } from '@/utils/speechFeedback';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  InteractionManager,
  LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { LiveSessionErrorBoundary } from '@/components/LiveSessionErrorBoundary';
import { diagBreadcrumb } from '@/lib/crashDiag';
import { clearInferenceInputBuffer, reuseInferenceInput } from '@/utils/inferenceInputBuffer';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraFormat, type Orientation } from 'react-native-vision-camera';

import { LiveSessionCameraPipeline, type FrameProcessorMeta } from '@/components/LiveSessionCameraPipeline';

import { useResolvedCamera } from '@/hooks/useResolvedCamera';
import type { RecordedFormError } from '@/types/recordedFormError';

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
import { analyzePose, type ErrorId, type Phase } from '@/modules/analyzer';
import { generateFeedback } from '@/modules/feedback';
import { sessionTrace } from '@/modules/sessionTrace';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { barbellProxyFromWrists } from '@/utils/barbellProxy';
import type { DeadliftFormCue } from '@/utils/deadliftPhase';
import { inferDeadliftFormCue, lateralHipHingeDegrees } from '@/utils/deadliftPhase';
import {
  DEADLIFT_REP_THRESH,
  hipsReliableForRepCount,
  primaryHipY,
  repBottomArmGate,
  smoothHipY,
  standingHipYFromBaseline,
} from '@/utils/deadliftRep';
import { mapPoseToPreviewSpace, orientedPreviewSize, shouldMirrorToMatchPreview } from '@/utils/modelFrameCoords';
import { framingHintFromPose } from '@/utils/framingGuide';
import { getSetTarget } from '@/utils/setPlan';
import { getContainPreviewRect, type ContainRect } from '@/utils/previewContainRect';
import { isPoseStableForLiftTracking, isPoseValid } from '@/utils/poseValidation';
import { createLowerBodyTrackState, stabilizeLowerBodyPose } from '@/utils/lowerBodyTrack';

// ─── Constants ────────────────────────────────────────────────────────────────

/** After “POSITION OK”: shorter than notebook (no streak there) — still lets user freeze before countdown. */
const HOLD_MS = 550;
const RING_SZ = 160;
const RING_R = 60;
const RING_C = 2 * Math.PI * RING_R;
/** Brief pause after last planned rep so the counter/UI updates before navigating away. */
const AUTO_FINISH_TARGET_REPS_DELAY_MS = 900;
/** Hold lockout (after a counted rep) this long to auto-finish without tapping FINISH SET. */
const LOCKOUT_IDLE_FINISH_MS = 4500;
/** Extra slack on lockoutTopY for idle detection (smoothed hip Y lags slightly). */
const LOCKOUT_IDLE_SLACK = 0.012;

type RepPhase = 'need_return' | 'need_setup' | 'need_lockout';

/** When each error may drive live banners / recording (rep FSM + hip height). */
function formFeedbackLiveForError(
  errorId: ErrorId,
  repPhase: RepPhase,
  hipY: number | null,
  standing: number | null,
  armedDeep: number,
  analyzerPhase?: Phase,
): boolean {
  if (standing == null) return false;
  const lockoutZoneY =
    standing +
    DEADLIFT_REP_THRESH.lockoutStandingSlack +
    DEADLIFT_REP_THRESH.lockoutCountSlack;
  const atLockoutTop = hipY != null && hipY <= lockoutZoneY + LOCKOUT_IDLE_SLACK;
  const bottomGate = standing + DEADLIFT_REP_THRESH.setupDropBelowStanding;
  const atSetupBottom = hipY != null && hipY > bottomGate;

  switch (errorId) {
    case 'ERR_001':
    case 'ERR_002':
      return repPhase === 'need_lockout' && armedDeep > 0;
    case 'ERR_003':
      if (atLockoutTop) return false;
      return repPhase === 'need_lockout' && armedDeep > 0;
    case 'ERR_004':
      if (!atLockoutTop) return false;
      return (
        analyzerPhase === 'lockout' ||
        repPhase === 'need_lockout' ||
        repPhase === 'need_return'
      );
    case 'ERR_005':
      return repPhase === 'need_setup' && analyzerPhase === 'setup' && atSetupBottom;
    default:
      return false;
  }
}

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
/** Push header controls down from status bar to sit in the camera letterbox band. */
const HEADER_CONTROLS_EXTRA_DOWN = 22;
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
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LiveSession'>>();
  const continuedWorkout = route.params?.continuedWorkout === true;
  const docForceFlow = route.params?.docForceFlow;
  const isFocused = useIsFocused();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clearResults = useSessionResultStore((s) => s.clear);
  const setStarted = useSessionResultStore((s) => s.setStartedAt);
  const setLastSetSummary = useSessionResultStore((s) => s.setLastSetSummary);
  const setSessionReview = useSessionResultStore((s) => s.setSessionReview);
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
  const [useFront, setUseFront] = useState(() => useUserPreferencesStore.getState().defaultCameraFront);
  const useFrontRef = useRef(useFront);
  useEffect(() => {
    useFrontRef.current = useFront;
  }, [useFront]);
  const position = useFront ? 'front' : 'back';

  const {
    device,
    allDevices,
    permissionStatus,
    cameraGranted,
    discovering,
    requestAccess,
    refreshEnumeration,
    fallbackPosition,
  } = useResolvedCamera({ position, isFocused });

  /** Portrait UI aspect ratio (VisionCamera expects width/height; sensor is landscape). */
  const portraitVideoAspectRatio = Math.max(winH, 1) / Math.max(winW, 1);

  const cameraFormat = useCameraFormat(device, [
    { videoAspectRatio: portraitVideoAspectRatio },
    { fps: Platform.OS === 'android' ? 20 : 30 },
    ...(Platform.OS === 'android'
      ? [{ videoResolution: { width: 720, height: 1280 } }]
      : []),
  ]);

  // ── Layout ─────────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  }, []);

  const previewFrameRef = useRef({ w: 0, h: 0 });
  const [previewFrameSize, setPreviewFrameSize] = useState({ w: 0, h: 0 });

  const previewContain = useMemo((): ContainRect => {
    if (layout.w < 16 || layout.h < 16) {
      return { ox: 0, oy: 0, vw: Math.max(1, layout.w), vh: Math.max(1, layout.h) };
    }
    const srcW =
      previewFrameSize.w > 0 ? previewFrameSize.w : cameraFormat?.videoWidth;
    const srcH =
      previewFrameSize.h > 0 ? previewFrameSize.h : cameraFormat?.videoHeight;
    if (srcW && srcH) {
      return getContainPreviewRect(layout.w, layout.h, srcW, srcH);
    }
    return { ox: 0, oy: 0, vw: layout.w, vh: layout.h };
  }, [layout.w, layout.h, cameraFormat, previewFrameSize.w, previewFrameSize.h]);

  // ── Session flow ────────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<Flow>('search');
  const [countdown, setCountdown] = useState(3);
  const [audioOn, setAudioOn] = useState(() => useUserPreferencesStore.getState().audioFeedbackEnabled);
  const audioOnRef = useRef(useUserPreferencesStore.getState().audioFeedbackEnabled);
  const [reps, setReps] = useState(0);
  const repsRef = useRef(0);
  const currentSetNumberRef = useRef(currentSetNumber);
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
  const lowerBodyTrackRef = useRef(createLowerBodyTrackState());
  const lastUiPoseAtRef = useRef(0);
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
  /** Peak ascent + highest lockout since arming — survives single-frame glitches. */
  const bestAscentSinceArmRef = useRef(0);
  const minHipYSinceArmRef = useRef(1);
  const deepHoldFramesRef = useRef(0);
  const lockoutQualifyingFramesRef = useRef(0);
  const hipSmoothRef = useRef<number | null>(null);
  /** False after COUNT until hips descend past returnGate — blocks re-arm at lockout height. */
  const setupArmingEnabledRef = useRef(true);
  /** Touch-and-go: bottom streak while still in need_return (fast descent skips return gate). */
  const touchGoBottomStreakRef = useRef(0);
  const lastCountAtRef = useRef(0);
  const autoFinishScheduledRef = useRef(false);
  const autoFinishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockoutIdleStartRef = useRef<number | null>(null);
  const plannedRepsPerSetRef = useRef(targetRepsForSet);
  const finishCurrentSetRef = useRef<() => void>(() => {});
  const scheduleAutoFinishRef = useRef<(reason: 'target_reps' | 'lockout_idle', delayMs: number) => void>(
    () => {},
  );
  /** Biomechanical cue streak per errorId → banner after stable detection. */
  const formErrStreakByIdRef = useRef<Map<ErrorId, number>>(new Map());
  const FORM_ERR_STREAK_TARGET = 3;
  /** Audio throttle for `generateFeedback` (max 1 cue / 2s in feedback module). */
  const lastFormAudioAtRef = useRef(0);
  /** One `addErrors` per `errorId` per session (summary / Session Complete). */
  const recordedFormErrIdsRef = useRef<Set<string>>(new Set());
  const showQuitModalRef = useRef(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [uiPose, setUiPose] = useState<PoseResult | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  /** False until initModel() finishes — camera mounts once so frameProcessor is never toggled mid-stream. */
  const [modelInitDone, setModelInitDone] = useState(false);
  /** Defer camera pipeline until navigation + ScrollView teardown finish (iOS Release Reanimated crash). */
  const [pipelineReady, setPipelineReady] = useState(false);
  /** iOS Release: preview-only camera first, then remount with frame processor (avoids FP + transition race). */
  const [inferMounted, setInferMounted] = useState(false);
  const [searchDotPhase, setSearchDotPhase] = useState(0);

  useEffect(() => {
    diagBreadcrumb('live_session:mount', { continuedWorkout });
    return () => diagBreadcrumb('live_session:unmount');
  }, [continuedWorkout]);

  useEffect(() => {
    if (!__DEV__ || docForceFlow !== 'active') return;
    setUseMock(true);
    setFlow('active');
    flowRef.current = 'active';
    setReps(3);
    repsRef.current = 3;
    setElapsedSec(84);
    const mock = getMockPose(Date.now(), Date.now());
    setUiPose(mock);
    setLiveFormBanner({
      message: t('formErrors.ERR_003'),
      backgroundColor: colors.surface_v3,
      textColor: colors.accent_yellow,
      severity: 'warning',
    });
  }, [docForceFlow, t]);
  const [cameraWarmupExpired, setCameraWarmupExpired] = useState(false);
  const [liveFormBanner, setLiveFormBanner] = useState<{
    message: string;
    backgroundColor: string;
    textColor: string;
    severity: 'critical' | 'warning';
  } | null>(null);
  const [livePhase, setLivePhase] = useState<Phase | null>(null);
  const [lastRepFlash, setLastRepFlash] = useState<{
    rep: number;
    durationSec: string;
  } | null>(null);
  const lastRepFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pulsing dot indicator (search state) — plain RN, no Reanimated (conflicts with VC on iOS Release) ─
  useEffect(() => {
    if (flow !== 'search') {
      setSearchDotPhase(0);
      return;
    }
    const id = setInterval(() => setSearchDotPhase((p) => (p + 1) % 3), 450);
    return () => clearInterval(id);
  }, [flow]);

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
        formErrStreakByIdRef.current = new Map();
      } else if (flow === 'active') {
        sessionTrace.session('lift_started', { mock: useMock, continued: continuedWorkout });
        formErrStreakByIdRef.current = new Map();
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

  useEffect(() => {
    currentSetNumberRef.current = currentSetNumber;
  }, [currentSetNumber]);

  const finishCurrentSet = useCallback(() => {
    clearAutoFinishTimers();
    void Speech.stop();
    const repCount = repsRef.current;
    const elapsed = Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000));
    setLastSetSummary(repCount, elapsed);

    const resultState = useSessionResultStore.getState();
    const configState = useSessionConfigStore.getState();
    setSessionReview({
      capturedAt: Date.now(),
      startedAt: resultState.startedAt,
      currentSetNumber: resultState.currentSetNumber,
      lastSetReps: repCount,
      lastSetElapsedSec: elapsed,
      errors: [...resultState.workoutFormErrors, ...resultState.errors],
      workoutSetSnapshots: [...resultState.workoutSetSnapshots],
      planSlice: {
        customSetPlan: configState.customSetPlan,
        setCount: configState.setCount,
        repsPerSet: configState.repsPerSet,
        weightAmount: configState.weightAmount,
        setPlans: configState.setPlans,
      },
      weightUnit: configState.weightUnit,
      exercise: configState.exercise,
      plannedSetCount: configState.setCount,
    });

    navigation.navigate('SessionComplete');
  }, [navigation, setLastSetSummary, setSessionReview, clearAutoFinishTimers]);

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

  /** Wait for stack transition to finish before mounting Vision Camera (avoids Reanimated scroll-event crash). */
  useEffect(() => {
    if (!isFocused || !modelInitDone || !cameraGranted || device == null) {
      setPipelineReady(false);
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          setPipelineReady(true);
          diagBreadcrumb('live_session:pipeline_ready');
        }
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
      setPipelineReady(false);
    };
  }, [isFocused, modelInitDone, cameraGranted, device]);

  /** iOS Release: preview camera first, then remount with frame processor after settle delay. */
  useEffect(() => {
    const canMount = cameraGranted && device != null && modelInitDone && pipelineReady;
    const wantsInfer = modelReady && !useMock;
    if (!canMount || !wantsInfer) {
      setInferMounted(false);
      return;
    }
    if (Platform.OS === 'ios' && !__DEV__) {
      setInferMounted(false);
      const t = setTimeout(() => {
        setInferMounted(true);
        diagBreadcrumb('live_session:infer_mount');
      }, 700);
      return () => clearTimeout(t);
    }
    setInferMounted(true);
    diagBreadcrumb('live_session:infer_mount');
  }, [cameraGranted, device, modelInitDone, pipelineReady, modelReady, useMock]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!continuedWorkout) {
      clearResults();
      setStarted(Date.now());
    }
    setReps(0);
    setElapsedSec(0);
    setLivePhase(null);
    setLastRepFlash(null);
    if (lastRepFlashTimeoutRef.current) {
      clearTimeout(lastRepFlashTimeoutRef.current);
      lastRepFlashTimeoutRef.current = null;
    }
    recordedFormErrIdsRef.current = new Set();
    formErrStreakByIdRef.current = new Map();
    lastFormAudioAtRef.current = 0;
  }, [continuedWorkout, clearResults, setStarted]);

  useEffect(() => () => {
    void Speech.stop();
    if (lastRepFlashTimeoutRef.current) clearTimeout(lastRepFlashTimeoutRef.current);
    lowerBodyTrackRef.current = createLowerBodyTrackState();
  }, []);

  useEffect(() => {
    if (!cameraGranted || device != null || allDevices.length === 0) return;
    const hasPreferred = allDevices.some((d) => d.position === position);
    const hasFallback = allDevices.some((d) => d.position === fallbackPosition);
    if (!hasPreferred && hasFallback) {
      setUseFront(fallbackPosition === 'front');
    }
  }, [cameraGranted, device, allDevices, position, fallbackPosition]);

  useEffect(() => {
    if (!isFocused || permissionStatus !== 'not-determined') return;
    void requestAccess();
  }, [permissionStatus, isFocused, requestAccess]);

  useEffect(() => {
    void (async () => {
      try {
        const ok = await initModel();
        const ready = ok && getModel() != null;
        setModelReady(ready);
        setUseMock(__DEV__ && !ready);
        sessionTrace.model(ready ? 'ready' : 'unavailable', { ok, ready });
        if (__DEV__ && !ready) sessionTrace.model('mock_fallback');
        diagBreadcrumb('live_session:model_init', { ok, ready });
      } finally {
        setModelInitDone(true);
      }
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
    const now = Date.now();
    if (now - lastUiPoseAtRef.current >= 150) {
      lastUiPoseAtRef.current = now;
      setUiPose(pose);
    }

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
          lockoutStreakRef.current = 0;
          if (y > returnGlitchY) {
            returnStreakRef.current = 0;
            touchGoBottomStreakRef.current = 0;
            deepestSetupHipYRef.current = 0;
          } else if (y >= returnGate) {
            returnStreakRef.current += 1;
            if (returnStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveReturnFrames) {
              repPhaseRef.current = 'need_setup';
              returnStreakRef.current = 0;
              touchGoBottomStreakRef.current = 0;
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

          // Touch-and-go: lockout → floor without pausing at return gate (fast reps skip need_setup).
          if (y > bottomGate) {
            deepestSetupHipYRef.current = Math.max(deepestSetupHipYRef.current, y);
            touchGoBottomStreakRef.current += 1;
            if (touchGoBottomStreakRef.current >= DEADLIFT_REP_THRESH.consecutiveSetupFrames) {
              const armedCandidate = deepestSetupHipYRef.current;
              const gate = repBottomArmGate(armedCandidate, bottomGate, lastCountAtRef.current);
              if (!gate.ok) {
                sessionTrace.armReject({
                  phase: 'need_return',
                  path: 'touch_go',
                  reason: gate.reason,
                  hipY: y,
                  armedCandidate,
                  sinceCount: Date.now() - lastCountAtRef.current,
                });
                touchGoBottomStreakRef.current = 0;
                deepestSetupHipYRef.current = 0;
              } else {
                armedDeepHipYRef.current = armedCandidate;
                deepestSetupHipYRef.current = 0;
                touchGoBottomStreakRef.current = 0;
                repPhaseRef.current = 'need_lockout';
                armedAtRef.current = Date.now();
                bestAscentSinceArmRef.current = 0;
                minHipYSinceArmRef.current = 1;
                deepHoldFramesRef.current = 0;
                lockoutQualifyingFramesRef.current = 0;
                sessionTrace.repPhase(repPhaseBefore, 'need_lockout', {
                  hipY: y,
                  armed: armedDeepHipYRef.current,
                  standing: stand,
                  bottomGate,
                  minDeep: gate.minDeep,
                  lockoutTopY,
                  touchGo: true,
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
            touchGoBottomStreakRef.current = Math.max(0, touchGoBottomStreakRef.current - 1);
            if (touchGoBottomStreakRef.current === 0) {
              deepestSetupHipYRef.current = 0;
            }
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
              const gate = repBottomArmGate(armedCandidate, bottomGate, lastCountAtRef.current);
              if (!gate.ok) {
                sessionTrace.armReject({
                  phase: 'need_setup',
                  reason: gate.reason,
                  hipY: y,
                  armedCandidate,
                  sinceCount: Date.now() - lastCountAtRef.current,
                });
                setupStreakRef.current = 0;
                deepestSetupHipYRef.current = 0;
              } else {
              armedDeepHipYRef.current = armedCandidate;
              deepestSetupHipYRef.current = 0;
              repPhaseRef.current = 'need_lockout';
              setupStreakRef.current = 0;
              armedAtRef.current = Date.now();
              bestAscentSinceArmRef.current = 0;
              minHipYSinceArmRef.current = 1;
              deepHoldFramesRef.current = 0;
              lockoutQualifyingFramesRef.current = 0;
              sessionTrace.repPhase(repPhaseBefore, 'need_lockout', {
                hipY: y,
                armed: armedDeepHipYRef.current,
                standing: stand,
                bottomGate,
                minDeep: gate.minDeep,
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
          const lockoutRearmCeiling =
            lockoutTopY + DEADLIFT_REP_THRESH.lockoutRearmUpperRomSlack;
          const inUpperRom = y <= lockoutRearmCeiling;
          if (
            !inUpperRom &&
            y > bottomGate &&
            y <= rearmMaxY &&
            deep > 0 &&
            y > deep + DEADLIFT_REP_THRESH.lockoutRearmMinDrop
          ) {
            armedDeepHipYRef.current = Math.max(deep, y);
            armedAtRef.current = Date.now();
            bestAscentSinceArmRef.current = 0;
            minHipYSinceArmRef.current = 1;
            lockoutQualifyingFramesRef.current = 0;
            sessionTrace.rep('rearm', {
              hipY: y,
              armed: armedDeepHipYRef.current,
              prevDeep: deep,
            });
          }
          const armedDeep = armedDeepHipYRef.current;
          const ascent = armedDeep > 0 ? armedDeep - y : 0;
          bestAscentSinceArmRef.current = Math.max(bestAscentSinceArmRef.current, ascent);
          minHipYSinceArmRef.current = Math.min(minHipYSinceArmRef.current, y);
          if (rawY != null) {
            minHipYSinceArmRef.current = Math.min(minHipYSinceArmRef.current, rawY);
          }
          if (y > bottomGate) deepHoldFramesRef.current += 1;

          const bottomOk = armedDeep >= bottomGate + DEADLIFT_REP_THRESH.minBottomClearanceBeyondGate;
          const armAgeMs = Date.now() - armedAtRef.current;
          const hipsOk = hipsReliableForRepCount(pose);
          const bestAscent = bestAscentSinceArmRef.current;
          const lockoutCeiling =
            lockoutTopY + DEADLIFT_REP_THRESH.lockoutCountSlack;
          const romComplete = bestAscent >= DEADLIFT_REP_THRESH.repRomCompleteNorm;
          const currentRomOk =
            ascent >=
            DEADLIFT_REP_THRESH.repRomCompleteNorm *
              DEADLIFT_REP_THRESH.lockoutCountCurrentRomFrac;
          const atLockoutNow = y <= lockoutCeiling;
          const sawLockout = minHipYSinceArmRef.current <= lockoutCeiling;
          const heldBottom = deepHoldFramesRef.current >= DEADLIFT_REP_THRESH.minDeepHoldFrames;
          const stuckAtBottom =
            bestAscent < DEADLIFT_REP_THRESH.repRomCompleteNorm * DEADLIFT_REP_THRESH.staleResetMaxAscentFrac;
          const slowRepUnderway =
            bestAscent >=
            DEADLIFT_REP_THRESH.repRomCompleteNorm * DEADLIFT_REP_THRESH.slowRepAscentProgressFrac;
          const armAgeMax = slowRepUnderway
            ? DEADLIFT_REP_THRESH.maxArmAgeForCountSlowMs
            : DEADLIFT_REP_THRESH.maxArmAgeForCount;
          const cycleExhausted =
            armAgeMs > armAgeMax && !(romComplete && sawLockout && heldBottom && bottomOk);

          if (armAgeMs > DEADLIFT_REP_THRESH.maxLockoutWaitMs && stuckAtBottom) {
            lockoutStreakRef.current = 0;
            sessionTrace.rep('stale_reset', {
              armAgeMs,
              hipY: y,
              ascent,
              bestAscent,
              deepHold: deepHoldFramesRef.current,
            });
            armedDeepHipYRef.current = 0;
            armedAtRef.current = 0;
            bestAscentSinceArmRef.current = 0;
            minHipYSinceArmRef.current = 1;
            deepHoldFramesRef.current = 0;
            lockoutQualifyingFramesRef.current = 0;
            repPhaseRef.current = 'need_setup';
            setupArmingEnabledRef.current = false;
          } else if (cycleExhausted) {
            lockoutStreakRef.current = 0;
            sessionTrace.rep('stale_reset', {
              armAgeMs,
              hipY: y,
              ascent,
              bestAscent,
              deepHold: deepHoldFramesRef.current,
              reason: 'cycle_exhausted',
            });
            armedDeepHipYRef.current = 0;
            armedAtRef.current = 0;
            bestAscentSinceArmRef.current = 0;
            minHipYSinceArmRef.current = 1;
            deepHoldFramesRef.current = 0;
            lockoutQualifyingFramesRef.current = 0;
            repPhaseRef.current = 'need_setup';
            setupArmingEnabledRef.current = false;
          } else {
          const armAgeOk =
            armAgeMs >= DEADLIFT_REP_THRESH.minMsFromArmToCount && armAgeMs <= armAgeMax;
          const canCountFrame = poseValidNow && hipsOk && armAgeOk;
          const repLooksReal =
            romComplete &&
            currentRomOk &&
            atLockoutNow &&
            sawLockout &&
            heldBottom &&
            bottomOk;
          const lockoutFramesRequired =
            bestAscent >=
            DEADLIFT_REP_THRESH.repRomCompleteNorm * DEADLIFT_REP_THRESH.lockoutStrongRomFrac
              ? 1
              : DEADLIFT_REP_THRESH.consecutiveLockoutFrames;

          if (canCountFrame && repLooksReal) {
            lockoutQualifyingFramesRef.current += 1;
          } else if (
            repLooksReal &&
            armAgeOk &&
            lockoutQualifyingFramesRef.current > 0 &&
            !canCountFrame
          ) {
            sessionTrace.countBlocked({
              reason: !poseValidNow ? 'pose_invalid' : !hipsOk ? 'hips_low_score' : 'arm_age',
              hipY: y,
              bestAscent,
              qualifying: lockoutQualifyingFramesRef.current,
              required: lockoutFramesRequired,
              armAgeMs,
            });
            lockoutQualifyingFramesRef.current = 0;
          }

          if (
            canCountFrame &&
            repLooksReal &&
            lockoutQualifyingFramesRef.current >= lockoutFramesRequired
          ) {
            setupStreakRef.current = 0;
            const now = Date.now();
            if (now - lastRepAtRef.current >= DEADLIFT_REP_THRESH.minMsBetweenReps) {
              const deepHoldSnap = deepHoldFramesRef.current;
              lastRepAtRef.current = now;
              lastCountAtRef.current = now;
              lockoutStreakRef.current = 0;
              armedDeepHipYRef.current = 0;
              armedAtRef.current = 0;
              bestAscentSinceArmRef.current = 0;
              minHipYSinceArmRef.current = 1;
              deepHoldFramesRef.current = 0;
              lockoutQualifyingFramesRef.current = 0;
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
                  bestAscent,
                  deepHold: deepHoldSnap,
                  armAgeMs,
                });
                if (next >= plannedRepsPerSetRef.current) {
                  scheduleAutoFinishRef.current('target_reps', AUTO_FINISH_TARGET_REPS_DELAY_MS);
                }
                return next;
              });
              if (lastRepFlashTimeoutRef.current) {
                clearTimeout(lastRepFlashTimeoutRef.current);
              }
              setLastRepFlash({
                rep: repsRef.current + 1,
                durationSec: (armAgeMs / 1000).toFixed(1),
              });
              lastRepFlashTimeoutRef.current = setTimeout(() => {
                setLastRepFlash(null);
                lastRepFlashTimeoutRef.current = null;
              }, 2200);
              void impactAsync(ImpactFeedbackStyle.Medium);
            }
          }
          }
        }

        if (
          !autoFinishScheduledRef.current &&
          repsRef.current >= plannedRepsPerSetRef.current &&
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
        const baselineSamples = baselineHipSamplesRef.current;
        const baselineReady =
          baselineSamples.length >= DEADLIFT_REP_THRESH.baselineFrameCount;
        const baselineSpread =
          baselineSamples.length > 0
            ? Math.max(...baselineSamples) - Math.min(...baselineSamples)
            : 0;
        const baselineSettled =
          baselineSpread <= DEADLIFT_REP_THRESH.baselineMaxSpread ||
          baselineSamples.length >= DEADLIFT_REP_THRESH.baselineMaxFrames;
        if (baselineReady && baselineSettled) {
          standingHipYRef.current = standingHipYFromBaseline(baselineSamples);
          sessionTrace.rep('baseline', {
            standing: standingHipYRef.current,
            spread: baselineSpread,
            frames: baselineSamples.length,
          });
        }
      } else if (repPhaseRef.current === 'need_lockout') {
        lockoutStreakRef.current = 0;
      }
    }

      if (stage === 'active' && !showQuitModalRef.current) {
      const analysis = analyzePose(pose, historyRef.current.slice(-16));
      setLivePhase(analysis.phase);
      const activeErrIds = analysis.errors.map((e) => e.errorId);
      if (activeErrIds.length > 0) {
        sessionTrace.analyzer(
          analysis.phase,
          activeErrIds,
        );
      }

      const formHipY =
        hipSmoothRef.current != null && hipSmoothRef.current > 0
          ? hipSmoothRef.current
          : hipY;
      let liveErrors = analysis.errors.filter((e) =>
        formFeedbackLiveForError(
          e.errorId,
          repPhaseRef.current,
          formHipY,
          standingHipYRef.current,
          armedDeepHipYRef.current,
          analysis.phase,
        ),
      );
      if (
        liveErrors.some((e) => e.errorId === 'ERR_004') &&
        analysis.phase === 'lockout'
      ) {
        liveErrors = liveErrors.filter(
          (e) => e.errorId !== 'ERR_001' && e.errorId !== 'ERR_002',
        );
      }
      const liveErrIds = liveErrors.map((e) => e.errorId);

      for (const err of liveErrors) {
        const next = (formErrStreakByIdRef.current.get(err.errorId) ?? 0) + 1;
        formErrStreakByIdRef.current.set(err.errorId, next);
      }
      for (const id of [...formErrStreakByIdRef.current.keys()]) {
        if (!liveErrIds.includes(id)) formErrStreakByIdRef.current.set(id, 0);
      }

      const fb = generateFeedback(
        { ...analysis, errors: liveErrors },
        lastFormAudioAtRef.current,
      );
      const topStreak = fb.topError
        ? (formErrStreakByIdRef.current.get(fb.topError.errorId) ?? 0)
        : 0;
      const streakTarget =
        fb.topError?.severity === 'critical' ? 1 : FORM_ERR_STREAK_TARGET;
      const formAnalysisLive = fb.topError != null;
      const setNum = currentSetNumberRef.current;
      const repNum = analysis.phase === 'setup' ? 0 : Math.max(1, repsRef.current);
      const hipSwayOnRep =
        hasFormErrorRecord(recordedFormErrIdsRef.current, 'ERR_001', setNum, repNum) ||
        hasFormErrorRecord(recordedFormErrIdsRef.current, 'ERR_002', setNum, repNum);
      const isHipSway =
        fb.topError?.errorId === 'ERR_001' || fb.topError?.errorId === 'ERR_002';
      const showBn =
        formAnalysisLive &&
        topStreak >= streakTarget &&
        fb.activeBanner != null &&
        !showQuitModalRef.current;

      const skipRecord =
        (fb.topError != null &&
          fb.topError.errorId === 'ERR_005' &&
          hasFormErrorRecorded(recordedFormErrIdsRef.current, 'ERR_001')) ||
        (isHipSway &&
          hipSwayOnRep &&
          fb.topError != null &&
          !hasFormErrorRecord(
            recordedFormErrIdsRef.current,
            fb.topError.errorId,
            setNum,
            repNum,
          ));

      const recordKey =
        fb.topError != null
          ? formErrorRecordKey(fb.topError.errorId, setNum, repNum)
          : '';

      if (
        showBn &&
        fb.topError &&
        !skipRecord &&
        !recordedFormErrIdsRef.current.has(recordKey)
      ) {
        recordedFormErrIdsRef.current.add(recordKey);
        const recorded: RecordedFormError = {
          ...fb.topError,
          setNumber: setNum,
          repNumber: repNum,
          phase: analysis.phase,
        };
        addErrors([recorded]);
        sessionTrace.formErrorRecorded(fb.topError.errorId, repsRef.current, analysis.phase);
        if (fb.topError.severity === 'critical') {
          void impactAsync(ImpactFeedbackStyle.Medium);
        }
      }

      if (showBn && fb.audioMessage && audioOnRef.current) {
        speakFeedbackMessage(fb.audioMessage);
        lastFormAudioAtRef.current = Date.now();
      }

      setLiveFormBanner((prev) => {
        if (!formAnalysisLive || topStreak < streakTarget) return null;
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

  const stabilizeMapped = useCallback((mapped: PoseResult) => {
    const { pose, state } = stabilizeLowerBodyPose(
      mapped,
      lowerBodyTrackRef.current,
      Date.now(),
    );
    lowerBodyTrackRef.current = state;
    return pose;
  }, []);

  // ── Mock pose loop (dev only, only if TFLite failed) ───────────────────────
  useEffect(() => {
    if (!__DEV__ || !isFocused || !useMock) return;
    const id = setInterval(() => ingestPose(stabilizeMapped(getMockPose(Date.now(), Date.now()))), 200);
    return () => clearInterval(id);
  }, [isFocused, useMock, ingestPose, stabilizeMapped]);

  // ── Coordinate transforms ──────────────────────────────────────────────────
  /**
   * Resize plugin center-crops to square before 192×192; uncrop to full buffer (SravB-style
   * frameWidth/frameHeight scale) then rotate into portrait preview space.
   */

  const mapInferencePose = useCallback(
    (raw: PoseResult, frameOrientation: Orientation, frameMeta: FrameProcessorMeta) => {
      const oriented = orientedPreviewSize(
        frameMeta.width,
        frameMeta.height,
        frameOrientation,
      );
      if (
        previewFrameRef.current.w !== oriented.width ||
        previewFrameRef.current.h !== oriented.height
      ) {
        previewFrameRef.current = { w: oriented.width, h: oriented.height };
        setPreviewFrameSize({ w: oriented.width, h: oriented.height });
      }
      const mirrorPreview = shouldMirrorToMatchPreview({
        platform: Platform.OS,
        useFront: useFrontRef.current,
        isMirrored: frameMeta.isMirrored,
      });
      const mapped = mapPoseToPreviewSpace(
        raw,
        frameMeta.width,
        frameMeta.height,
        frameOrientation,
        { mirrorPreview },
      );
      return mapped;
    },
    [],
  );

  // ── Worklet result handler ─────────────────────────────────────────────────
  const onInferenceResultRef = useRef(
    (
      _values: number[],
      _kind: WorkletKind,
      _ts: number,
      _frameOrientation: Orientation,
      _frameMeta: FrameProcessorMeta,
    ) => {},
  );

  const onFramePixelsRef = useRef(
    (
      _pixels: Uint8Array,
      _ts: number,
      _frameOrientation: Orientation,
      _frameMeta: FrameProcessorMeta,
    ) => {},
  );

  const applyModelOutput = useCallback(
    (
      out: ArrayBuffer | ArrayBufferView,
      kind: WorkletKind,
      ts: number,
      frameOrientation: Orientation,
      frameMeta: FrameProcessorMeta,
    ) => {
      const shouldLogInferenceBundle =
        __DEV__ && flowRef.current === 'active' && !didLogOnce.current;
      if (shouldLogInferenceBundle) {
        didLogOnce.current = true;
        sessionTrace.rawTensor(
          kind,
          out instanceof Float32Array ? Array.from(out) : [],
        );
      }
      try {
        const raw = keypointsFromMovenetOutput(out, ts);
        ingestPose(stabilizeMapped(mapInferencePose(raw, frameOrientation, frameMeta)));
      } catch {
        // swallow
      }
    },
    [ingestPose, mapInferencePose, stabilizeMapped],
  );

  const onInferenceResult = useCallback(
    (values: number[], kind: WorkletKind, ts: number, frameOrientation: Orientation, frameMeta: FrameProcessorMeta) => {
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
        const o = `${frameOrientation}|mirrored=${frameMeta.isMirrored}|${Platform.OS}`;
        if (lastLoggedOrientation.current !== o) {
          lastLoggedOrientation.current = o;
          sessionTrace.infer('orientation', {
            orientation: frameOrientation,
            isMirrored: frameMeta.isMirrored,
            platform: Platform.OS,
            frameWidth: frameMeta.width,
            frameHeight: frameMeta.height,
          });
        }
        const tensor: ArrayBuffer | ArrayBufferView =
          kind === 'f32'
            ? new Float32Array(values)
            : kind === 'u8'
              ? new Uint8Array(values)
              : new Int8Array(values);
        const raw = keypointsFromMovenetOutput(tensor, ts);
        ingestPose(stabilizeMapped(mapInferencePose(raw, frameOrientation, frameMeta)));
      } catch {
        // swallow — worklet errors must not crash JS thread
      }
    },
    [ingestPose, mapInferencePose, stabilizeMapped],
  );

  /** JS fallback when TFLite runSync is unavailable in the camera worklet. */
  const onFramePixels = useCallback(
    (pixels: Uint8Array, ts: number, frameOrientation: Orientation, frameMeta: FrameProcessorMeta) => {
      const model = getModel();
      if (!model) return;
      try {
        const input = reuseInferenceInput(pixels);
        const outs = model.runSync([input]);
        const out = outs[0];
        if (out == null) return;
        if (out instanceof Float32Array) {
          applyModelOutput(out, 'f32', ts, frameOrientation, frameMeta);
        } else if (out instanceof ArrayBuffer) {
          applyModelOutput(out, 'f32', ts, frameOrientation, frameMeta);
        } else if (out instanceof Uint8Array) {
          applyModelOutput(out, 'u8', ts, frameOrientation, frameMeta);
        } else if (out instanceof Int8Array) {
          applyModelOutput(out, 'i8', ts, frameOrientation, frameMeta);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[LiveSession] inference failed:', e instanceof Error ? e.message : e);
        }
      }
    },
    [applyModelOutput],
  );

  useEffect(() => {
    return () => clearInferenceInputBuffer();
  }, []);

  useEffect(() => {
    onInferenceResultRef.current = onInferenceResult;
  }, [onInferenceResult]);

  useEffect(() => {
    onFramePixelsRef.current = onFramePixels;
  }, [onFramePixels]);

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

  /** Each set countdown recalibrates baseline + rep FSM on the next `active` entry. */
  useEffect(() => {
    if (flow === 'countdown') {
      activeEnteredRef.current = false;
    }
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
        bestAscentSinceArmRef.current = 0;
        minHipYSinceArmRef.current = 1;
        deepHoldFramesRef.current = 0;
        lockoutQualifyingFramesRef.current = 0;
        lastRepAtRef.current = 0;
        lastCountAtRef.current = 0;
        armedAtRef.current = 0;
        hipSmoothRef.current = null;
        setupArmingEnabledRef.current = true;
        touchGoBottomStreakRef.current = 0;
        clearAutoFinishTimers();
      }
    } else if (flow !== 'pose_lost') {
      activeEnteredRef.current = false;
    }
  }, [flow]);

  const requestCamAccess = useCallback(async () => {
    const status = await requestAccess();
    if (status !== 'granted') {
      await Linking.openSettings();
    }
    setCameraWarmupExpired(false);
  }, [requestAccess]);

  const retryCameraDiscovery = useCallback(() => {
    setCameraWarmupExpired(false);
    setUseFront((v) => !v);
    refreshEnumeration();
  }, [refreshEnumeration]);

  const openCameraSettings = useCallback(() => void Linking.openSettings(), []);

  /** Stop showing "Opening camera…" too soon on cold start (cleared app data). */
  useEffect(() => {
    if (!cameraGranted || device != null) {
      setCameraWarmupExpired(false);
      return;
    }
    const id = setTimeout(() => setCameraWarmupExpired(true), 15000);
    return () => clearTimeout(id);
  }, [cameraGranted, device, allDevices.length, discovering]);

  const cameraPrep =
    cameraGranted && device == null && (discovering || !cameraWarmupExpired)
      ? 'warming'
      : 'none';

  const cameraReady = cameraGranted && device != null;
  /** Mount camera pipeline once after TFLite init + navigation transition settle. */
  const canMountCamera = cameraReady && modelInitDone && pipelineReady;
  const sessionActive = canMountCamera || useMock;
  const showCameraGate = !sessionActive;

  const cameraGateKind: CameraGateKind | null = showCameraGate
    ? !cameraGranted
      ? 'permission'
      : cameraReady && !modelInitDone
        ? 'model_loading'
        : cameraReady && modelInitDone && !pipelineReady
          ? 'warming'
          : cameraPrep === 'warming'
            ? 'warming'
            : 'unavailable'
    : null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const showStop = sessionActive && (flow === 'active' || flow === 'pose_lost');
  const enableInference = modelReady && !useMock;
  const pipelineInferOn =
    enableInference && (Platform.OS !== 'ios' || __DEV__ || inferMounted);
  const pipelineKey = pipelineInferOn ? 'infer' : 'preview';
  const tfliteModel = modelReady ? getModel() : null;

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
  const trackingStatus = lastRepFlash
    ? t('liveSession.repFlash', {
        rep: lastRepFlash.rep,
        duration: lastRepFlash.durationSec,
      })
    : livePhase
      ? t(`formPhases.${livePhase}`)
      : t('liveSession.tracking');

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
    sessionActive &&
    (flow === 'search' || flow === 'detected' || flow === 'countdown');

  const framingHint = useMemo(() => {
    if (!showFramingGuide || !uiPose) return null;
    return framingHintFromPose(uiPose, isPoseValid(uiPose));
  }, [showFramingGuide, uiPose]);

  const headerScrimBottomPx = topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LiveSessionErrorBoundary onBack={() => navigation.goBack()}>
    <View style={styles.root} onLayout={onLayout}>
      {canMountCamera && device ? (
        <LiveSessionCameraPipeline
          key={pipelineKey}
          device={device}
          isActive={isFocused && canMountCamera}
          portraitVideoAspectRatio={portraitVideoAspectRatio}
          enableInference={pipelineInferOn}
          model={tfliteModel}
          onInferenceResultRef={onInferenceResultRef}
          onFramePixelsRef={onFramePixelsRef}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraBackdrop]} />
      )}

      {sessionActive ? (
        <>
          <FramingGuideOverlay
            containRect={previewContain}
            topReservePx={headerScrimBottomPx}
            visible={showFramingGuide}
            hint={framingHint}
          />
          {uiPose ? (
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
          ) : null}
        </>
      ) : null}

      <View
        style={[styles.topScrim, { height: topPad + HEADER_SCRIM_BODY_PX + HEADER_CONTROLS_EXTRA_DOWN }]}
        pointerEvents="none"
      />

      <View style={styles.headerBar} pointerEvents="box-none">
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
          {sessionActive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={useFront ? 'Use rear camera' : 'Use front camera'}
              onPress={() => setUseFront((v) => !v)}
              style={styles.circleBtn}
            >
              <SvgCameraReverseOutline color={colors.text_primary} size={22} />
            </Pressable>
          ) : (
            <View style={styles.circleBtnSpacer} />
          )}
        </View>
      </View>

      {cameraGateKind ? (
        <CameraGatePanel
          kind={cameraGateKind}
          permissionStatus={permissionStatus}
          useFront={useFront}
          t={t}
          onAllow={() => void requestCamAccess()}
          onOpenSettings={openCameraSettings}
          onFlip={retryCameraDiscovery}
          deviceCount={allDevices.length}
          topInset={topPad}
          bottomInset={insets.bottom}
        />
      ) : null}

      {sessionActive ? (
        <>
          <View style={styles.positionHudLayer} pointerEvents="box-none">
            {flow === 'search' ? (
              <View style={styles.overlayCenter} pointerEvents="none">
                <Text style={styles.searchingLbl}>{t('liveSession.searchingPose')}</Text>
                <View style={styles.dotsRow}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[styles.dot, { opacity: searchDotPhase === i ? 1 : 0.35 }]}
                    />
                  ))}
                </View>
                <View style={[styles.infoBanner, styles.searchAlertBelowSearching]}>
                  <SvgHudWalkPerson color={colors.text_secondary} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoBannerTitle}>{t('liveSession.getInPosition')}</Text>
                    <Text style={styles.infoBannerBody}>{t('liveSession.getInPositionBody')}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {flow === 'detected' ? (
              <View style={styles.overlayCenter} pointerEvents="none">
                <View style={[styles.infoBanner, styles.infoBannerGreen]}>
                  <SvgHudCheckCircle color={colors.primary_green} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoBannerTitle, { color: colors.primary_green }]}>
                      {t('liveSession.poseDetected')}
                    </Text>
                    <Text style={styles.infoBannerBody}>{t('liveSession.holdStill')}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {flow === 'countdown' ? (
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
                <Text style={styles.getReadyTxt}>{t('liveSession.getReady')}</Text>
              </View>
            ) : null}
          </View>

          {flow === 'pose_lost' && !showQuitWorkoutModal ? (
            <View style={[styles.topBannerAbs, { top: belowHeaderBannerTop, zIndex: 12 }]} pointerEvents="none">
              <View style={[styles.infoBanner, styles.infoBannerPoseLost]}>
                <SvgHudWarnTriangle color={colors.accent_yellow} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerPoseLostTitle}>{t('liveSession.poseLost')}</Text>
                  <Text style={styles.infoBannerBody}>{t('liveSession.poseLostDetail')}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {liveFormBanner && showStop && !showQuitWorkoutModal && flow !== 'pose_lost' ? (
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
                    {t('liveSession.formCue')}
                  </Text>
                  <Text style={[styles.formFeedbackTxt, { color: liveFormBanner.textColor }]}>
                    {liveFormBanner.message}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {showStop ? (
            <View
              style={[styles.statsPanel, { paddingBottom: Math.max(32, insets.bottom + 14) }]}
              onLayout={onTrackingStripLayout}
            >
              <View style={[styles.statusPill, lastRepFlash ? styles.statusPillFlash : null]}>
                <View style={styles.statusDot} />
                <Text style={styles.statusTxt} numberOfLines={2}>
                  {trackingStatus}
                </Text>
              </View>
              <View style={styles.statsRow}>
                <StatCard label={t('liveSession.reps')} value={`${reps}/${targetRepsForSet}`} />
                <StatCard label={t('common.sets')} value={`${currentSetNumber}/${plannedSetCount}`} />
                <StatCard label={t('liveSession.time')} value={elapsedClock} green />
              </View>
              <PrimaryButton
                title={t('liveSession.finishSet')}
                variant="primary"
                onPress={finishCurrentSet}
                style={styles.finishSetBtn}
              />
              <PrimaryButton
                title={t('liveSession.quitWorkout')}
                variant="ghost"
                onPress={() => setShowQuitWorkoutModal(true)}
                style={styles.quitWorkoutBtn}
              />
            </View>
          ) : null}

          {!showQuitWorkoutModal ? (
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
          ) : null}

          {__DEV__ && useMock ? (
            <View style={[styles.devChip, { top: belowHeaderBannerTop }]} pointerEvents="none">
              <Text style={styles.devChipTxt}>{t('liveSession.mock')}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {showQuitWorkoutModal ? (
        <Pressable style={styles.modalOverlay} onPress={() => setShowQuitWorkoutModal(false)}>
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalWarnIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>{t('liveSession.quitTitle')}</Text>
            <Text style={styles.modalBody}>{t('liveSession.quitBody')}</Text>
            <View style={styles.modalSummaryBox}>
              <Text style={styles.modalSummaryMain}>
                {t('liveSession.setSummary', {
                  set: currentSetNumber,
                  weight: setWeightAmount,
                  unit: weightUnit === 'kg' ? 'KG' : 'LB',
                  reps,
                })}{' '}
                · {elapsedClock}
              </Text>
            </View>
            <Pressable style={styles.modalKeepBtn} onPress={() => setShowQuitWorkoutModal(false)}>
              <Text style={styles.modalKeepTxt}>{t('liveSession.keepLifting')}</Text>
            </Pressable>
            <Pressable style={styles.modalEndBtn} onPress={onConfirmQuitWholeWorkout}>
              <Text style={styles.modalEndTxt}>{t('liveSession.quitConfirm')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
    </LiveSessionErrorBoundary>
  );
}

type CameraGateKind = 'permission' | 'warming' | 'model_loading' | 'unavailable';

function CameraGatePanel({
  kind,
  permissionStatus,
  useFront,
  deviceCount,
  t,
  onAllow,
  onOpenSettings,
  onFlip,
  topInset,
  bottomInset,
}: {
  kind: CameraGateKind;
  permissionStatus: ReturnType<typeof Camera.getCameraPermissionStatus>;
  useFront: boolean;
  deviceCount: number;
  t: ReturnType<typeof useTranslation>['t'];
  onAllow: () => void;
  onOpenSettings: () => void;
  onFlip: () => void;
  topInset: number;
  bottomInset: number;
}) {
  const denied = permissionStatus === 'denied' || permissionStatus === 'restricted';

  const title =
    kind === 'permission'
      ? t('liveSession.cameraRequired')
      : kind === 'warming'
        ? t('liveSession.openingCamera')
        : kind === 'model_loading'
          ? t('liveSession.loadingPoseModel')
          : t('liveSession.noCamera');

  const body =
    kind === 'permission'
      ? t('liveSession.cameraSettingsHint')
      : kind === 'warming'
        ? t('liveSession.cameraWarmingHint')
        : kind === 'model_loading'
          ? t('liveSession.loadingPoseModelHint')
          : denied
            ? t('liveSession.cameraDeniedDeviceHint')
            : t('liveSession.cameraEnumFailedHint');

  return (
    <View
      style={[
        styles.cameraGate,
        { paddingTop: topInset + 72, paddingBottom: Math.max(bottomInset, 24) + 16 },
      ]}
    >
      <View style={styles.cameraGateCard}>
        <Text style={styles.cameraGateTitle}>{title}</Text>
        <Text style={styles.cameraGateBody}>{body}</Text>

        {kind === 'warming' || kind === 'model_loading' ? (
          <View style={styles.cameraGateDots}>
            <View style={styles.cameraGateDot} />
            <View style={[styles.cameraGateDot, styles.cameraGateDotMid]} />
            <View style={styles.cameraGateDot} />
          </View>
        ) : (
          <View style={styles.cameraGateActions}>
            {kind === 'permission' ? (
              denied ? (
                <PrimaryButton title={t('liveSession.openSettings')} onPress={onOpenSettings} />
              ) : (
                <PrimaryButton title={t('liveSession.allowCamera')} onPress={onAllow} />
              )
            ) : (
              <>
                <PrimaryButton title={t('liveSession.flipCamera')} onPress={onFlip} />
                <PrimaryButton
                  title={t('liveSession.openSettings')}
                  variant="ghost"
                  onPress={onOpenSettings}
                  style={styles.cameraGateSecondaryBtn}
                />
              </>
            )}
          </View>
        )}

        {kind === 'unavailable' ? (
          <Text style={styles.cameraGateFootnote}>
            {deviceCount === 0
              ? t('liveSession.cameraZeroDevicesHint')
              : t('liveSession.flipHint', {
                  side: useFront ? t('liveSession.front') : t('liveSession.rear'),
                })}
          </Text>
        ) : null}
      </View>
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

  cameraBackdrop: {
    backgroundColor: colors.bg_v3,
  },
  cameraGate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    backgroundColor: colors.bg_v3,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cameraGateCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 14,
  },
  cameraGateTitle: {
    color: colors.text_primary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodyLg,
    lineHeight: 26,
  },
  cameraGateBody: {
    color: colors.text_secondary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.bodySm,
    lineHeight: 22,
  },
  cameraGateActions: {
    gap: 10,
    marginTop: 4,
  },
  cameraGateSecondaryBtn: {
    marginTop: 0,
  },
  cameraGateFootnote: {
    color: colors.text_muted,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    lineHeight: 18,
    marginTop: 2,
  },
  cameraGateDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  cameraGateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary_green,
    opacity: 0.45,
  },
  cameraGateDotMid: {
    opacity: 1,
  },
  circleBtnSpacer: {
    width: 44,
    height: 44,
  },

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
  flipBtn: { marginTop: 8 },

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
  infoBannerPoseLost: {
    backgroundColor: colors.surface_v3,
    borderColor: colors.accent_yellow,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 16,
  },
  infoBannerPoseLostTitle: {
    color: colors.accent_yellow,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 3,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
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
    maxWidth: '92%',
  },
  statusPillFlash: {
    backgroundColor: 'rgba(39,195,79,0.18)',
    borderColor: colors.primary_green,
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
    textAlign: 'center',
    flexShrink: 1,
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
