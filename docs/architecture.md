# RepRight — Architecture Overview

## Data Flow

```
Camera Feed (30 fps)
    │
    ▼
Vision Camera Frame Processor
    │  (runs on UI thread, worklet)
    ▼
MoveNet Lightning (TFLite)
    │  Input:  192×192 RGB tensor
    │  Output: [1, 1, 17, 3] tensor
    │  Latency target: < 7ms
    ▼
PoseResult { keypoints[17], score, timestamp }
    │
    ▼
Biomechanical Analyzer
    │  - detectPhase()         (hip Y relative to shoulder Y)
    │  - checkLumbarRounding() (ERR_001)
    │  - checkHipsTooHigh()    (ERR_002)
    │  - checkBarDrift()       (ERR_003)
    │  - checkHyperextension() (ERR_004)
    │  - checkShoulderBar()    (ERR_005)
    ▼
AnalysisResult { phase, errors[], angles, repDetected }
    │
    ├──▶ FeedbackEngine → FeedbackOutput { banner, haptic, audio }
    │         │
    │         ▼
    │    Camera Screen (overlay)
    │
    └──▶ Session Logger → AsyncStorage
              │
              ▼
         History Screen
```

## Module Responsibilities

| Module | File | Responsibility |
|---|---|---|
| MoveNet | `src/modules/movenet.ts` | TFLite model init + inference |
| Analyzer | `src/modules/analyzer.ts` | Phase detection + error classification |
| Scoring | `src/modules/scoring.ts` | Per-rep score 0–100 |
| Feedback | `src/modules/feedback.ts` | Banner / haptic / audio output |
| Session | `src/modules/session.ts` | AsyncStorage read/write |

## Key Design Decisions

- **MoveNet Lightning over Thunder** — 7ms vs 25ms inference, latency priority
- **Left-side keypoints only** — lateral view, user faces right by default
- **No cloud** — all inference on-device, video never leaves the phone
- **Phase-gated error detection** — each error only checked in relevant phases
- **3-frame persistence rule** — prevents single-frame false positive audio cues
