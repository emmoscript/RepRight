# RepRight

> AI-powered deadlift biomechanics analyzer. Real-time corrective feedback. 100% on-device.

**Thesis project — Universidad Iberoamericana (UNIBE), Santo Domingo, Dominican Republic**  
**Defense: June 2026**

---

## Team

| Member | ID | Role |
|---|---|---|
| Emil Moquete | 22-0969 | Lead Engineer — Architecture, ML integration, UI |
| Jean Roque | 23-0812 | Contributing Developer — UI screens, data layer |
| Javier Jarp | 23-0466 | Contributing Developer — Session logging, profile |

**Advisor:** Ing. Karoline Taylor Vásquez, MBA

---

## What It Does

RepRight uses the device camera to analyze deadlift technique in real time using MoveNet Lightning pose estimation. It detects 5 biomechanical errors and provides corrective audio/visual feedback — no trainer, no internet connection required.

All inference runs **100% on-device** (edge computing). Video never leaves the phone.

### The 5 Biomechanical Parameters

| Error ID | Parameter | Severity |
|---|---|---|
| ERR_001 | Lumbar rounding (angle < 150°) | Critical |
| ERR_002 | Hips too high at initiation | Critical |
| ERR_003 | Bar drift away from body | Warning |
| ERR_004 | Hyperextension at lockout | Warning |
| ERR_005 | Shoulder behind bar at setup | Warning |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native (Expo bare workflow) |
| Pose estimation | MoveNet Lightning — TensorFlow Lite (LiteRT) |
| Camera | React Native Vision Camera |
| ML runtime | react-native-fast-tflite |
| Analysis logic | Custom TypeScript geometric algorithms |
| State management | Zustand |
| Local storage | AsyncStorage |
| Target OS | iOS 14+ / Android 8+ |

---

## Architecture

```
Camera Feed (30fps)
    ↓
Frame Processor (Vision Camera)
    ↓
MoveNet Lightning (TFLite) → 17 keypoints
    ↓
Biomechanical Analyzer (TypeScript)
    ↓
Error Classifier → { errorId, severity, message }
    ↓
Feedback Engine → audio + visual overlay
    ↓
Session Logger → AsyncStorage
```

---

## App Screens

| Screen | Description |
|---|---|
| Home | Dashboard — last session, streak, start CTA |
| Workout (Configure) | Set up session: exercise + number of sets |
| Live Session | Full-screen camera + skeleton overlay + live feedback |
| Session Complete | Score ring, error breakdown, save |
| Stats / Rep Log | Weekly chart + session history (used for study data) |
| Profile | User info, participant ID, settings |
| Demo Mode | Test the system without logging a real session |

Full screen specs: [`docs/screens.md`](docs/screens.md)  
Design system: [`docs/design-system/design-system.md`](docs/design-system/design-system.md)  
HTML prototypes: [`docs/design-system/screens/`](docs/design-system/screens/)

---

## Design System

- **Dark mode first** — background `#0D0D0D`, surfaces `#1A1A1A`
- **Accent** — `#00FF87` (green) for success, CTAs, active states
- **Error** — `#FF4444` (red) for critical biomechanical errors
- **Warning** — `#FFB800` (amber) for warnings
- **Fonts** — Space Grotesk (headlines) + Inter (body)
- **Icons** — Material Symbols Outlined

---

## Performance Targets

| Metric | Target |
|---|---|
| Inference latency | < 7ms (MoveNet Lightning) |
| End-to-end latency | < 100ms per frame |
| Camera framerate | 30fps |
| Model size | ~3MB (Lightning) |

---

## Validation Study

| Parameter | Value |
|---|---|
| Design | Pre-experimental, single-group, pre-test/post-test |
| Sample | N = 15, non-probabilistic convenience |
| Age range | 20–39 years |
| Experience | Intermediate deadlift |
| Location | Gyms in Santo Domingo, DN, DR |
| Duration | 4 weeks continuous use |
| Analysis | Paired T-test (p < 0.05), Python SciPy |

---

## Success Metrics (Hypotheses)

1. ≥ 80% agreement with certified trainer evaluations
2. Statistically significant reduction in error frequency after 4 weeks
3. < 100ms end-to-end processing latency on mid-high-end devices
4. ≥ 60% of users complete 3+ sessions after onboarding
5. Significant improvement in biomechanical knowledge questionnaire

---

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- Xcode 14+ (iOS) or Android Studio (Android)
- Physical device (camera required for real use)

### Install

```bash
git clone https://github.com/YOUR_ORG/repright.git
cd repright
yarn install
```

### iOS

```bash
cd ios && pod install && cd ..
yarn ios
```

### Android

```bash
yarn android
```

> **Note:** The MoveNet Lightning `.tflite` model file (~3MB) is tracked via Git LFS.  
> Run `git lfs pull` after cloning to get it.

---

## Project Structure

```
repright/
├── src/
│   ├── screens/          # Screen-level components
│   ├── components/       # Reusable UI components
│   ├── modules/          # Core logic
│   │   ├── movenet.ts    # TFLite inference wrapper
│   │   ├── analyzer.ts   # 5-parameter biomechanical analyzer
│   │   ├── scoring.ts    # Per-rep score 0–100
│   │   ├── feedback.ts   # Audio + visual feedback engine
│   │   └── session.ts    # AsyncStorage session logger
│   ├── theme/            # colors.ts, typography.ts
│   ├── hooks/            # Custom React hooks
│   ├── navigation/       # React Navigation setup
│   └── utils/            # angles.ts math helpers
├── assets/
│   └── models/           # movenet_lightning.tflite (Git LFS)
└── docs/
    ├── architecture.md   # Data flow diagram
    ├── screens.md        # Full screen inventory + nav map
    └── design-system/
        ├── design-system.md   # Color, type, component specs
        ├── index.html         # Design system reference (open in browser)
        └── screens/           # HTML prototypes per screen
```

---

## Out of Scope (v1)

- Multi-angle analysis (frontal plane)
- Exercises other than conventional deadlift
- Cloud inference or cloud sync
- Social features
- Sumo deadlift variant

---

## License

Academic use only. Not for commercial distribution.  
© 2026 Emil Moquete, Jean Roque, Javier Jarp — UNIBE
