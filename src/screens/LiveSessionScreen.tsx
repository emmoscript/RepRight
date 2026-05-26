import { useIsFocused, useNavigation } from "@react-navigation/native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useResizePlugin } from "vision-camera-resize-plugin";

import { PrimaryButton } from "@/components/PrimaryButton";
import { SkeletonOverlay } from "@/components/SkeletonOverlay";
import { analyzePose } from "@/modules/analyzer";
import { generateFeedback } from "@/modules/feedback";
import {
  getMockPose,
  getModel,
  getModelLoadError,
  initModel,
  keypointsFromMovenetOutput,
  type PoseResult,
} from "@/modules/movenet";
import { useSessionConfigStore } from "@/store/sessionConfigStore";
import { useSessionResultStore } from "@/store/sessionResultStore";
import { useSessionSyncStore } from "@/store/sessionSyncStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { isPoseValid } from "@/utils/poseValidation";

const HOLD_MS = 800;

type Flow = "search" | "countdown" | "active" | "pose_lost";
type CameraPreference = "back" | "front";
type PreviewOrientation =
  | "portrait"
  | "portrait-upside-down"
  | "landscape-left"
  | "landscape-right";
type PoseRotationDeg = 0 | 90 | 180 | 270;
type WorkletOutputKind = "f32" | "u8" | "i8";
type PerfMode = "safe" | "balanced" | "fast";

export function LiveSessionScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const clearResults = useSessionResultStore((s) => s.clear);
  const addErrors = useSessionResultStore((s) => s.addErrors);
  const setStarted = useSessionResultStore((s) => s.setStartedAt);

  // Session sync
  const exercise = useSessionConfigStore((s) => s.exercise);
  const weight = useSessionConfigStore((s) => s.weight);
  const startSession = useSessionSyncStore((s) => s.startSession);
  const sessionIdRef = useRef<string | null>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const backDevice = useCameraDevice("back");
  const frontDevice = useCameraDevice("front");
  const allDevices = useCameraDevices();
  const [cameraPreference, setCameraPreference] =
    useState<CameraPreference>("front");
  const device =
    cameraPreference === "back"
      ? (backDevice ?? frontDevice ?? allDevices[0])
      : (frontDevice ?? backDevice ?? allDevices[0]);
  const { resize } = useResizePlugin();

  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  };

  const [flow, setFlow] = useState<Flow>("search");
  const [count, setCount] = useState(3);
  const flowRef = useRef<Flow>("search");
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  const holdAt = useRef<number | null>(null);
  const poseRef = useRef<PoseResult | null>(null);
  const historyRef = useRef<PoseResult[]>([]);
  const lastAudioAt = useRef(0);
  const streak = useRef<Record<string, number>>({});

  const [uiPose, setUiPose] = useState<PoseResult | null>(null);
  const [banner, setBanner] = useState<{
    message: string;
    color: string;
  } | null>(null);
  const [useMock, setUseMock] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [lastPoseAt, setLastPoseAt] = useState<number | null>(null);
  const [previewOrientation, setPreviewOrientation] =
    useState<PreviewOrientation>("portrait");
  const [manualRotationDeg, setManualRotationDeg] = useState<number>(0);
  const [poseRotationDeg, setPoseRotationDeg] = useState<PoseRotationDeg>(
    Platform.OS === "android" ? 90 : 0,
  );
  const [workletInferenceEnabled, setWorkletInferenceEnabled] =
    useState<boolean>(true);
  const [workletInferenceError, setWorkletInferenceError] = useState<
    string | null
  >(null);
  const isIosPlatform = Platform.OS === "ios";
  const [perfMode, setPerfMode] = useState<PerfMode>("balanced");
  const [effectiveInferFps, setEffectiveInferFps] = useState(0);
  const [fallbackCount, setFallbackCount] = useState(0);
  const inferTimestampsRef = useRef<number[]>([]);

  const handleEndSession = useCallback(() => {
    void Speech.stop();
    navigation.navigate("SessionComplete" as never);
  }, [navigation]);

  useEffect(() => {
    clearResults();
    setStarted(Date.now());

    // Start session in sync store
    void (async () => {
      const sessionId = await startSession(exercise, weight);
      sessionIdRef.current = sessionId;
    })();
  }, [clearResults, setStarted, exercise, weight, startSession]);

  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, []);

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
      setModelError(getModelLoadError());
    })();
  }, []);

  const ingestPose = useCallback(
    (pose: PoseResult) => {
      poseRef.current = pose;
      const h = historyRef.current;
      h.push(pose);
      if (h.length > 8) h.shift();
      setUiPose(pose);
      setLastPoseAt(Date.now());
      if (inferenceError) setInferenceError(null);

      const stage = flowRef.current;
      if (stage !== "active" && stage !== "pose_lost") {
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
      const confirmed = analysis.errors.filter(
        (e) => (st[e.errorId] ?? 0) >= 3,
      );

      if (confirmed.length) {
        addErrors(confirmed);
        const fb = generateFeedback(
          { ...analysis, errors: confirmed },
          lastAudioAt.current,
        );
        if (fb.activeBanner) {
          setBanner({
            message: fb.activeBanner.message,
            color: fb.activeBanner.backgroundColor,
          });
        } else {
          setBanner(null);
        }
        if (fb.triggerHaptic) {
          void impactAsync(ImpactFeedbackStyle.Medium);
        }
        if (fb.audioMessage) {
          lastAudioAt.current = performance.now();
          Speech.speak(fb.audioMessage, { language: "en", rate: 0.95 });
        }
      } else {
        setBanner(null);
      }
    },
    [addErrors, inferenceError],
  );

  useEffect(() => {
    if (!isFocused || !useMock) return;
    const id = setInterval(() => {
      const t = Date.now();
      ingestPose(getMockPose(t, t));
    }, 200);
    return () => clearInterval(id);
  }, [isFocused, useMock, ingestPose]);

  const transformPoseForDisplay = useCallback(
    (pose: PoseResult): PoseResult => {
      const rotated = pose.keypoints.map((k) => {
        if (poseRotationDeg === 90) {
          return { x: 1 - k.y, y: k.x, score: k.score };
        }
        if (poseRotationDeg === 180) {
          return { x: 1 - k.x, y: 1 - k.y, score: k.score };
        }
        if (poseRotationDeg === 270) {
          return { x: k.y, y: 1 - k.x, score: k.score };
        }
        return k;
      });
      // Front preview is mirrored; mirror pose so overlay matches what user sees.
      const mirrored =
        cameraPreference === "front"
          ? rotated.map((k) => ({ x: 1 - k.x, y: k.y, score: k.score }))
          : rotated;
      return { ...pose, keypoints: mirrored };
    },
    [cameraPreference, poseRotationDeg],
  );

  const unCropPoseToPreview = useCallback(
    (
      pose: PoseResult,
      sourceWidth: number,
      sourceHeight: number,
    ): PoseResult => {
      if (sourceWidth <= 0 || sourceHeight <= 0) return pose;
      const srcAspect = sourceWidth / sourceHeight;
      const targetAspect = 1; // 192x192 model input
      const keypoints = pose.keypoints.map((k) => {
        if (srcAspect > targetAspect) {
          const cropW = sourceHeight * targetAspect;
          const xOff = (sourceWidth - cropW) / 2;
          const x = (k.x * cropW + xOff) / sourceWidth;
          return { x, y: k.y, score: k.score };
        }
        if (srcAspect < targetAspect) {
          const cropH = sourceWidth / targetAspect;
          const yOff = (sourceHeight - cropH) / 2;
          const y = (k.y * cropH + yOff) / sourceHeight;
          return { x: k.x, y, score: k.score };
        }
        return k;
      });
      return { ...pose, keypoints };
    },
    [],
  );

  const onWorkletInferenceResult = useCallback(
    (
      values: number[],
      kind: WorkletOutputKind,
      ts: number,
      sourceWidth: number,
      sourceHeight: number,
    ) => {
      try {
        const toDisplayPose = (rawPose: PoseResult) =>
          transformPoseForDisplay(
            unCropPoseToPreview(rawPose, sourceWidth, sourceHeight),
          );
        inferTimestampsRef.current.push(Date.now());
        if (inferTimestampsRef.current.length > 80)
          inferTimestampsRef.current.shift();
        if (kind === "f32") {
          const parsed = keypointsFromMovenetOutput(
            Float32Array.from(values),
            ts,
          );
          ingestPose(toDisplayPose(parsed));
          return;
        }
        if (kind === "u8") {
          const parsed = keypointsFromMovenetOutput(
            Uint8Array.from(values),
            ts,
          );
          ingestPose(toDisplayPose(parsed));
          return;
        }
        const parsed = keypointsFromMovenetOutput(Int8Array.from(values), ts);
        ingestPose(toDisplayPose(parsed));
      } catch (error) {
        setInferenceError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [ingestPose, transformPoseForDisplay, unCropPoseToPreview],
  );

  const onWorkletInferenceFailure = useCallback((message: string) => {
    setWorkletInferenceEnabled(false);
    setWorkletInferenceError(message);
    setFallbackCount((c) => c + 1);
  }, []);

  const runJsWorkletInferenceResult = useCallback(
    Worklets.createRunOnJS(
      (
        values: number[],
        kind: WorkletOutputKind,
        ts: number,
        sourceWidth: number,
        sourceHeight: number,
      ) => {
        onWorkletInferenceResult(values, kind, ts, sourceWidth, sourceHeight);
      },
    ),
    [onWorkletInferenceResult],
  );

  const runJsWorkletInferenceFailure = useCallback(
    Worklets.createRunOnJS((message: string) => {
      onWorkletInferenceFailure(message);
    }),
    [onWorkletInferenceFailure],
  );

  const model = getModel();
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const period = isIosPlatform
        ? perfMode === "fast"
          ? 90
          : perfMode === "balanced"
            ? 120
            : 180
        : perfMode === "fast"
          ? 120
          : perfMode === "balanced"
            ? 180
            : 260;
      const window = isIosPlatform
        ? perfMode === "fast"
          ? 55
          : perfMode === "balanced"
            ? 60
            : 50
        : perfMode === "fast"
          ? 100
          : perfMode === "balanced"
            ? 95
            : 80;
      const gate = Date.now() % period;
      if (gate > window) return;
      const r = resize(frame, {
        scale: { width: 192, height: 192 },
        pixelFormat: "rgb",
        dataType: "uint8",
      });
      const u8 = new Uint8Array(r);
      if (!workletInferenceEnabled || model == null) return;
      try {
        const outs = model.runSync([u8]);
        const out = outs[0];
        const ts = Date.now();
        const sw = frame.width;
        const sh = frame.height;
        if (out instanceof Float32Array) {
          runJsWorkletInferenceResult(Array.from(out), "f32", ts, sw, sh);
          return;
        }
        if (out instanceof Uint8Array) {
          runJsWorkletInferenceResult(Array.from(out), "u8", ts, sw, sh);
          return;
        }
        if (out instanceof Int8Array) {
          runJsWorkletInferenceResult(Array.from(out), "i8", ts, sw, sh);
          return;
        }
        if (out instanceof ArrayBuffer) {
          runJsWorkletInferenceResult(
            Array.from(new Float32Array(out)),
            "f32",
            ts,
            sw,
            sh,
          );
          return;
        }
        runJsWorkletInferenceFailure("Unsupported worklet output tensor type");
      } catch (error) {
        runJsWorkletInferenceFailure(String(error));
      }
    },
    [
      isIosPlatform,
      model,
      perfMode,
      resize,
      runJsWorkletInferenceFailure,
      runJsWorkletInferenceResult,
      workletInferenceEnabled,
    ],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const recent = inferTimestampsRef.current.filter((t) => now - t <= 2000);
      inferTimestampsRef.current = recent;
      const fps = recent.length / 2;
      setEffectiveInferFps(Number.isFinite(fps) ? Number(fps.toFixed(1)) : 0);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // 7A–7C–7D machine
  useEffect(() => {
    const id = setInterval(() => {
      const pose = poseRef.current;
      const valid = pose != null && isPoseValid(pose);
      if (flowRef.current === "search") {
        if (valid) {
          if (holdAt.current == null) holdAt.current = Date.now();
          if (Date.now() - (holdAt.current ?? 0) >= HOLD_MS) {
            holdAt.current = null;
            setCount(3);
            setFlow("countdown");
          }
        } else {
          holdAt.current = null;
        }
        return;
      }
      if (flowRef.current === "countdown") {
        if (!valid) {
          setFlow("search");
          holdAt.current = null;
        }
      } else if (flowRef.current === "active") {
        if (!valid) setFlow("pose_lost");
      } else if (flowRef.current === "pose_lost") {
        if (valid) setFlow("active");
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (flow !== "countdown") return;
    setCount(3);
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          setFlow("active");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [flow]);

  const skColor =
    flow === "countdown" || (flow === "search" && uiPose && isPoseValid(uiPose))
      ? colors.primary_green
      : flow === "pose_lost" ||
          (flow === "search" && (!uiPose || !isPoseValid(uiPose)))
        ? colors.skeleton_muted_v3
        : colors.primary_green;
  const showStop = flow === "active" || flow === "pose_lost";
  const runAnalysis = flow === "active" || flow === "pose_lost";
  const showSkeleton =
    uiPose && (flow === "search" || flow === "countdown" || runAnalysis);
  const basePreviewRotationDeg =
    previewOrientation === "landscape-left"
      ? 90
      : previewOrientation === "landscape-right"
        ? -90
        : 0;
  const finalPreviewRotationDeg =
    Platform.OS === "android"
      ? basePreviewRotationDeg + manualRotationDeg
      : manualRotationDeg;

  const useFrame = modelReady && !useMock;
  const cameraLabel = cameraPreference === "back" ? "Back" : "Front";
  const cycleCameraPreference = () => {
    setCameraPreference((prev) => (prev === "back" ? "front" : "back"));
  };
  const cycleRotation = () => {
    setManualRotationDeg((prev) => {
      const next = prev + 90;
      return next >= 360 ? 0 : next;
    });
  };
  const cyclePoseRotation = () => {
    setPoseRotationDeg((prev) => {
      if (prev === 0) return 90;
      if (prev === 90) return 180;
      if (prev === 180) return 270;
      return 0;
    });
  };
  const cyclePerfMode = () => {
    setPerfMode((prev) => {
      if (prev === "safe") return "balanced";
      if (prev === "balanced") return "fast";
      return "safe";
    });
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {hasPermission && device ? (
        <View style={styles.cameraBox}>
          <View
            style={[
              StyleSheet.absoluteFill,
              finalPreviewRotationDeg !== 0 && {
                transform: [{ rotate: `${finalPreviewRotationDeg}deg` }],
              },
            ]}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isFocused}
              frameProcessor={useFrame ? frameProcessor : undefined}
              androidPreviewViewType="texture-view"
              outputOrientation="preview"
              onPreviewOrientationChanged={(o) =>
                setPreviewOrientation(o as PreviewOrientation)
              }
              pixelFormat="yuv"
            />
            {showSkeleton && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <SkeletonOverlay
                  width={layout.w}
                  height={layout.h}
                  keypoints={uiPose!.keypoints}
                  lineColor={skColor}
                  pointColor={skColor}
                  dynamicColors
                />
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.cameraBox, styles.cameraPlaceholder]}>
          <Text style={styles.caption}>
            {!hasPermission
              ? "Camera permission required for live analysis."
              : allDevices.length === 0
                ? "Searching camera device..."
                : "No camera device available. Verify AVD camera mapping (front/back)."}
          </Text>
        </View>
      )}

      <View style={styles.hud} pointerEvents="box-none">
        <Pressable onPress={cycleCameraPreference} style={styles.cameraSwitch}>
          <Text style={styles.cameraSwitchText}>Camera: {cameraLabel}</Text>
        </Pressable>
        <Pressable onPress={cycleRotation} style={styles.rotateSwitch}>
          <Text style={styles.cameraSwitchText}>
            Rotate: {manualRotationDeg}°
          </Text>
        </Pressable>
        <Pressable onPress={cyclePoseRotation} style={styles.poseSwitch}>
          <Text style={styles.cameraSwitchText}>Pose: {poseRotationDeg}°</Text>
        </Pressable>
        <Pressable onPress={cyclePerfMode} style={styles.perfSwitch}>
          <Text style={styles.cameraSwitchText}>Speed: {perfMode}</Text>
        </Pressable>
        {flow === "search" && (
          <Text style={styles.hudTitle}>
            Side view — get full body in frame
          </Text>
        )}
        {flow === "countdown" && (
          <Text style={styles.countText}>{String(count || 0)}</Text>
        )}
        {flow === "pose_lost" && <Text style={styles.warn}>Pose lost</Text>}
        {useMock && (
          <Text style={styles.dev}>
            Mock pose — add real movenet .tflite for inference
          </Text>
        )}
        {modelError && (
          <Text style={styles.dev}>MoveNet error: {modelError}</Text>
        )}
        {!useMock && !modelError && (
          <Text style={styles.dev2}>
            Pose stream:{" "}
            {lastPoseAt && Date.now() - lastPoseAt < 1000 ? "live" : "waiting"}
          </Text>
        )}
        {!useMock && !modelError && (
          <Text style={styles.dev4}>
            Worklet: {workletInferenceEnabled ? "on" : "off"} | Fallbacks:{" "}
            {fallbackCount} | Infer FPS: {effectiveInferFps}
          </Text>
        )}
        {inferenceError && (
          <Text style={styles.dev3}>Inference error: {inferenceError}</Text>
        )}
        {workletInferenceError && (
          <Text style={styles.dev3}>
            Worklet inference fallback: {workletInferenceError}
          </Text>
        )}
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
            onPress={handleEndSession}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  cameraBox: { flex: 1, backgroundColor: "#000" },
  cameraPlaceholder: { justifyContent: "center", alignItems: "center" },
  hud: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingTop: 60,
  },
  cameraSwitch: {
    position: "absolute",
    top: 44,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rotateSwitch: {
    position: "absolute",
    top: 80,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  poseSwitch: {
    position: "absolute",
    top: 116,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  perfSwitch: {
    position: "absolute",
    top: 152,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cameraSwitchText: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
  },
  hudTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 18,
  },
  countText: {
    color: colors.primary_green,
    fontSize: 80,
    fontFamily: typography.fontFamily.bold,
    marginTop: 40,
  },
  warn: {
    color: colors.accent_yellow,
    fontSize: 18,
    marginTop: 24,
    fontFamily: typography.fontFamily.medium,
  },
  dev: {
    color: colors.text_muted,
    fontSize: 12,
    position: "absolute",
    bottom: 100,
  },
  dev2: {
    color: colors.text_muted,
    fontSize: 12,
    position: "absolute",
    bottom: 82,
  },
  dev4: {
    color: colors.text_muted,
    fontSize: 12,
    position: "absolute",
    bottom: 46,
    paddingHorizontal: 8,
  },
  dev3: {
    color: colors.accent_red,
    fontSize: 12,
    position: "absolute",
    bottom: 64,
    paddingHorizontal: 8,
  },
  banner: {
    position: "absolute",
    bottom: 160,
    left: 16,
    right: 16,
    borderRadius: 10,
    padding: 12,
  },
  bannerText: {
    color: "#0A0A0A",
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    textAlign: "center",
  },
  caption: {
    color: colors.text_secondary,
    textAlign: "center",
    padding: 16,
    fontSize: 14,
  },
  footer: { padding: 20, paddingBottom: 32, backgroundColor: colors.bg_v3 },
});
