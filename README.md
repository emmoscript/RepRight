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
Live Session State Machine (7A → 7B → 7C → 7D)
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

Full architecture: [`docs/architecture.md`](docs/architecture.md)

---

## App Screens

| Screen | Description |
|---|---|
| Demo Mode / Onboarding | Scrollable app presentation, no login required |
| Sign Up | Create account |
| Login | Sign in |
| Email Confirmation | OTP code verification |
| Home | Dashboard — last session, streak, start CTA |
| Configure Session | Set up session: exercise + number of sets |
| Live Session (7A–7D) | Full-screen camera + skeleton overlay + live feedback |
| Stop Session Modal | Confirmation dialog before ending session |
| Session Complete | Score ring, error breakdown, save |
| Stats / Rep Log | Weekly chart + session history (study data source) |
| Profile | User info, participant ID, settings |

Full screen specs: [`docs/screens.md`](docs/screens.md)

---

## Design System

- **Dark mode** — background `#0D0D0D`, surfaces `#1A1919` / `#201F1F`
- **Primary** — `#27C34F` (green) for CTAs, active states, skeleton overlay
- **Error** — `#FF4444` for critical errors and STOP SESSION button
- **Warning** — `#FFB800` (amber) for warning-level errors
- **Fonts** — Space Grotesk Bold (headlines) + Inter (body/labels)
- **Icons** — Material Symbols Outlined

Full design system: [`docs/design-system/design-system-v3.md`](docs/design-system/design-system-v3.md)  
HTML prototypes: [`docs/design-system/screens-v3/`](docs/design-system/screens-v3/)

---

## Live Session Flow

The app validates pose before starting analysis through 4 states:

```
7A Positioning → 7B Detected → 7C Countdown (3-2-1) → 7D Active Analysis
```

- Skeleton is muted gray `#484847` until pose is detected
- Skeleton turns green `#27C34F` on detection
- STOP SESSION button appears **only** in state 7D
- If pose is lost mid-session: pauses without resetting rep count

Full spec: [`docs/live-session-flow.md`](docs/live-session-flow.md)

**Form errors (ERR_001–ERR_005):** [`docs/form-errors.md`](docs/form-errors.md)  
**Rep counting FSM:** [`docs/rep-counting.md`](docs/rep-counting.md)  
**Evaluation protocol:** [`docs/effectiveness-evaluation.md`](docs/effectiveness-evaluation.md)  
**Dev session logs:** [`docs/session-debug.md`](docs/session-debug.md)  
**Doc index:** [`docs/README.md`](docs/README.md)

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

1. >= 80% agreement with certified trainer evaluations
2. Statistically significant reduction in error frequency after 4 weeks
3. < 100ms end-to-end processing latency on mid-high-end devices
4. >= 60% of users complete 3+ sessions after onboarding
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

Requires **Android Studio** (bundled **JBR**, typically JDK **17–23**) — **not** Oracle **Java 24+** alone on `PATH` (Gradle will fail). `npm run android` runs `scripts/run-expo-android.cjs`, which prefers `JAVA_HOME` / `REPRIGHT_ANDROID_JDK` when they point to JDK 17–23, otherwise scans Android Studio installs (including **JetBrains Toolbox** paths) and common **Temurin** / **Microsoft** JDK folders.

To see which JDK the script picks: `node scripts/run-expo-android.cjs --dry-jdk`

The launcher also sets **`ANDROID_HOME`** and writes **`android/local.properties`** (`sdk.dir=…`) from `%LOCALAPPDATA%\Android\Sdk` when Gradle cannot find the SDK.

**USB phone (dev client install / native rebuild):**

```bash
npm install
npm run android:device
```

Uses `JAVA_HOME` only if it points to JDK 17–23; otherwise scans Android Studio’s `jbr` (and similar). Override with **the real JDK root** (folder that contains `bin\java.exe`):

```powershell
setx REPRIGHT_ANDROID_JDK "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
```

(Use your actual path — not the words `full\path` from examples.) `setx` applies to **new** terminals; this repo’s launcher also reads the User variable so `--dry-jdk` can work in the **same** window after `setx`.

Then start JS as usual: `npm run start:lan` or `npx expo start` (port **8081**).

**Emulator / default device selection:**

```bash
npm run android
```

> **Note:** Until `adb devices` shows your phone as `device` (not `offline`), USB install cannot proceed — enable USB debugging and authorize the PC.

> **Note:** The MoveNet Lightning `.tflite` model file (~3MB) is tracked via Git LFS.
> Run `git lfs pull` after cloning to get it.

---

## Project Structure

```
repright/
├── src/
│   ├── screens/          # Screen-level components
│   ├── components/       # Reusable UI components
│   ├── modules/
│   │   ├── movenet.ts    # TFLite inference wrapper
│   │   ├── analyzer.ts   # 5-parameter biomechanical analyzer
│   │   ├── scoring.ts    # Per-rep score 0-100
│   │   ├── feedback.ts   # Audio + visual feedback engine
│   │   └── session.ts    # AsyncStorage session logger
│   ├── theme/
│   │   ├── colors.ts     # Color tokens v3 (#27C34F primary)
│   │   └── typography.ts # Space Grotesk + Inter
│   ├── hooks/
│   ├── navigation/
│   └── utils/            # angles.ts geometric helpers
├── assets/
│   └── models/           # movenet_lightning.tflite (Git LFS)
└── docs/
    ├── architecture.md
    ├── screens.md
    ├── live-session-flow.md
    └── design-system/
        ├── design-system-v3.md
        └── screens-v3/   # HTML prototypes (8 screens)
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

MIT License — © 2026 Emil Moquete, Jean Roque, Javier Jarp — UNIBE