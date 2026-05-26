# RepRight — Architecture Overview

## Data Flow

```
Camera Feed (30 fps)
    │
    ▼
Vision Camera Frame Processor
    │  (runs on JS thread via worklet)
    ▼
Live Session State Machine
    │  7A Positioning → 7B Detected → 7C Countdown → 7D Active
    │  isPoseValid() gates the transition from 7A to 7B
    ▼
MoveNet Lightning (TFLite) — runs every frame in 7D
    │  Input:  192×192 RGB tensor
    │  Output: [1, 1, 17, 3] tensor → 17 KeyPoints
    │  Latency target: < 7ms
    ▼
PoseResult { keypoints[17], score, timestamp }
    │
    ▼
Biomechanical Analyzer (phase-gated)
    │  - detectPhase()         hip Y relative to shoulder Y
    │  - checkLumbarRounding() ERR_001 (critical) — pull_initiation, mid_pull
    │  - checkHipsTooHigh()    ERR_002 (critical) — pull_initiation only
    │  - checkBarDrift()       ERR_003 (warning)  — mid_pull
    │  - checkHyperextension() ERR_004 (warning)  — lockout
    │  - checkShoulderBar()    ERR_005 (warning)  — setup
    │  Full catalog: docs/form-errors.md
    ▼
AnalysisResult { phase, errors[], angles, repDetected }
    │
    ├──▶ FeedbackEngine
    │         │  - Throttle: max 1 audio cue per 2 seconds
    │         │  - Persistence: error must appear in ≥ 3 consecutive frames
    │         │  - Priority: critical before warning, then by confidence
    │         ▼
    │    FeedbackOutput { banner, haptic, audio }
    │         │
    │         ▼
    │    Live Session UI Overlay
    │         - Error banner: #FF4444 (critical) | #FFB800 (warning)
    │         - Skeleton: #27C34F active | #FF4444 error joint | #484847 muted
    │
    └──▶ Session Logger
              │  - Writes to AsyncStorage on session end
              │  - Key pattern: session_{sessionId}
              │  - Index key: session_index → string[]
              ▼
         Stats Screen / Rep Log

```

---

## Module Responsibilities

| Module | File | Responsibility |
|---|---|---|
| MoveNet | `src/modules/movenet.ts` | TFLite model init + inference |
| Analyzer | `src/modules/analyzer.ts` | Phase detection + 5-error classification |
| Scoring | `src/modules/scoring.ts` | Per-rep score 0–100 using color tokens |
| Feedback | `src/modules/feedback.ts` | Banner / haptic / audio, throttled |
| Session | `src/modules/session.ts` | AsyncStorage CRUD |

---

## Live Session State Machine

```typescript
type LiveSessionState =
  | 'positioning'  // 7A: camera on, skeleton muted, searching for pose
  | 'detected'     // 7B: pose found, ~800ms hold, skeleton green
  | 'countdown'    // 7C: 3-2-1 countdown ring, skeleton green
  | 'active'       // 7D: full analysis, stats panel visible, STOP button
  | 'pose_lost';   // 7D sub-state: paused, reverts to muted skeleton

// Transitions
// positioning → detected:  isPoseValid() returns true
// detected    → countdown: auto after 800ms (pose must stay valid)
// countdown   → active:    countdown reaches 0
// active      → pose_lost: isPoseValid() returns false mid-session
// pose_lost   → active:    isPoseValid() returns true again (no countdown reset)
// any         → positioning: pose lost in detected or countdown state
```

---

## Pose Validation

```typescript
const REQUIRED_KEYPOINT_PAIRS = [
  [KEYPOINTS.LEFT_SHOULDER, KEYPOINTS.RIGHT_SHOULDER],
  [KEYPOINTS.LEFT_HIP,      KEYPOINTS.RIGHT_HIP],
  [KEYPOINTS.LEFT_KNEE,     KEYPOINTS.RIGHT_KNEE],
  [KEYPOINTS.LEFT_ANKLE,    KEYPOINTS.RIGHT_ANKLE],
];

const MIN_CONFIDENCE = 0.3;

function isPoseValid(pose: PoseResult): boolean {
  return REQUIRED_KEYPOINT_PAIRS.every(([leftIdx, rightIdx]) => {
    const left  = pose.keypoints[leftIdx];
    const right = pose.keypoints[rightIdx];
    return left.score >= MIN_CONFIDENCE || right.score >= MIN_CONFIDENCE;
  });
}
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| MoveNet Lightning over Thunder | 7ms vs 25ms — latency is critical at 30fps |
| Left-side keypoints primary | Lateral view, user faces right by default |
| No cloud inference | Privacy guarantee + no internet dependency in gym |
| Phase-gated error detection | Each error only checked in relevant phase |
| 3-frame persistence rule | Prevents single-frame false positive audio cues |
| isPoseValid() gate | Prevents analysis starting before user is in frame |
| Pose lost = pause not restart | Mid-session interruptions don't reset progress |

---

## Performance Targets

| Metric | Target | Notes |
|---|---|---|
| MoveNet inference | < 7ms | Lightning model on modern device |
| End-to-end frame latency | < 100ms | Inference + analysis + UI update |
| Camera framerate | 30fps | Vision Camera default |
| Model size | ~3MB | Lightning TFLite |
| Session storage | < 1MB | AsyncStorage per session |

---

## Data Structures

```typescript
// Core inference output
interface PoseResult {
  keypoints: KeyPoint[];  // always 17 — MoveNet standard
  score: number;          // overall pose confidence 0–1
  timestamp: number;      // ms since session start
}

// Per-rep score stored in session log
interface RepLog {
  repNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  score: number;          // 0–100
  errors: Array<{
    errorId: string;      // ERR_001 ... ERR_005
    frameCount: number;   // frames error was active
    totalFrames: number;  // total frames in rep
  }>;
}

// Full session stored to AsyncStorage
interface SessionLog {
  sessionId: string;       // uuid
  participantId: string;   // P001 ... P015 (anonymized for study)
  date: string;            // ISO 8601
  sets: Array<{
    setNumber: number;
    reps: RepLog[];
  }>;
  summary: {
    totalReps: number;
    avgScore: number;
    mostFrequentError: string | null;
  };
}
```
