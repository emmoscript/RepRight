# RepRight — Screen Inventory & Navigation Map

## Navigation Structure

```
Bottom Tab Bar (always visible, 4 tabs)
├── [home]         Home
├── [fitness_center] Workout
├── [bar_chart]    Stats
└── [person]       Profile

Non-tab screens (pushed onto stack):
├── Live Session   (entered from Workout → Configure → Start)
├── Session Complete (auto-shown when session ends)
└── Demo Mode      (entered from Home or Workout)
```

---

## Tab 1 — Home Screen

**Purpose:** Dashboard. Quick access to start a session, see last performance, track streak.

**Components:**
- Header: RepRight logo (top left) + STOP SESSION button (top right, outlined green)
- Hero greeting: "Good morning, [Name]" — Space Grotesk bold
- CTA button: "START DEADLIFT SESSION" — full width, #00FF87 fill, black text, play icon
- Last Session card: date, score %, sets × reps
- Quick stats row: Total Sessions | Current Streak (fire icon, #FFB800)
- Recent Activity list: 2 items max, green or red left border by score
- Weekly Volume mini chart: accent green bars

**Active nav tab:** Home (home icon, filled, #00FF87)

---

## Tab 2 — Workout Screen (Configure Session)

**Purpose:** Pre-session setup. User picks sets before starting.

**Components:**
- Title: "CONFIGURE" — Space Grotesk bold 5xl
- Subtitle: "Performance Session" — muted, uppercase
- Exercise selector:
  - Deadlift — active, green left border, check_circle icon
  - Squat — grayed out, lock icon, "Coming soon"
  - Romanian Deadlift — grayed out, lock icon, "Coming soon"
- Sets selector: pill buttons [ 2 ] [ 3 ] [ 4 ] [ 5 ] — default 3 selected in green
- Info note: "Reps will be counted automatically" — info icon + Inter body text
- Last performance preview cards (2-col): Last kg | Recovery %
- Floating CTA: "START SESSION →" — fixed above bottom nav, full width green

**Active nav tab:** Workout (fitness_center icon, filled, #00FF87)

---

## Tab 3 — Stats Screen (Rep Log)

**Purpose:** Historical performance log. Primary data source for thesis study analysis.

**Components:**
- Header: "REP LOG" — Space Grotesk bold 5xl–7xl
- Subtitle: "Review your biomechanical performance history"
- Filter pills: THIS WEEK | LAST WEEK | MONTHLY — active pill in #00FF87
- Weekly Volume bar chart: 7 bars (M–S), accent green, inside a surface card
- Peak Form metric card: best % score with green left border
- Session list (Deadlift sessions only):
  - Each item: date (MMM DD), session name, sets × reps, form score badge
  - Score ≥ 70 → green badge; Score < 70 → red badge
  - Critical errors → red left border on card
  - Chevron right arrow for detail navigation

**Active nav tab:** Stats (bar_chart icon, filled, #00FF87)

---

## Tab 4 — Profile Screen

**Purpose:** User identity, study participation info, app settings.

**Components:**
- Avatar: circular, green border, verified badge (check icon, green, bottom-right)
- Name + Participant ID (P001, P002…) — mono font, muted
- Stats row (3-col): Best Form % | Total Sessions | Streak
- Study card: "Study Participant P001" + enrollment date + clinical_notes icon
- Performance Settings section:
  - Notifications — toggle (on by default, green)
  - Camera Prefs — chevron right
  - Units — "Metric" right-aligned in green
- Logout button: full width, red outlined, "Log Out"
- Version string: bottom center, muted, tiny

**Active nav tab:** Profile (person icon, filled, #00FF87)

---

## Stack Screen — Live Session

**Purpose:** Real-time deadlift analysis. Core product screen.

**Layout:** Full-screen camera preview (portrait). All UI overlaid on top.

**Components:**
- Top bar (transparent, over camera): RepRight logo + STOP SESSION
- Skeleton SVG overlay (drawn over camera feed):
  - Default joints/lines: #00FF87
  - Error keypoint: #FF4444 with glow drop-shadow
- Right side floating controls: camera flip | audio toggle | settings (circular buttons, blur backdrop)
- Status bar (centered, pill shape): green pulse dot + "TRACKING DEADLIFT" + accuracy %
- Error banner (above stats): icon + "AI LIVE FEEDBACK" label + message
  - Critical: #FF4444 background
  - Warning: #FFB800 background, dark text
- Stats row (3 cards, blur backdrop): REP | SERIES | TIME — Space Grotesk bold

**Nav bar:** still visible at bottom, Workout tab active

---

## Stack Screen — Session Complete

**Purpose:** Post-session summary. Score, errors, save action.

**Components:**
- Title: "SESSION COMPLETE" — Space Grotesk italic bold
- Circular score ring: conic-gradient (#00FF87 filled to score%, dark remainder)
- Score number: large, center — "87 / 100"
- Score label badge: EXCELLENT | GOOD | NEEDS WORK | POOR FORM
- Stats 2×2 grid cards: VOLUME (total reps) | SETS | TIME | AVG SCORE
- Form Adjustments Detected section:
  - Each error: colored dot + name + severity badge
  - CRITICAL → red badge (#FF4444)
  - WARNING → amber badge (#FFB800)
  - GOOD → green badge (#00FF87)
- CTA: "SAVE & CONTINUE" — full width, green

**Nav bar:** Workout tab active

---

## Stack Screen — Demo Mode

**Purpose:** Show the system working without logging a real session. Used for thesis presentation and testing.

**Components:**
- Icon: precision_manufacturing symbol in a dark card (centered)
- Title: "Demo Mode" — Space Grotesk bold
- Subtitle: muted body text explaining purpose
- Skeleton figure card: SVG deadlift pose, green strokes, data tags floating (HIP ANGLE, LOAD PATH)
- Instructions card (3 steps, numbered 01 / 02 / 03):
  1. Position device 5–8 feet away, profile view
  2. Ensure full body in frame
  3. Perform movement — AI overlays real-time biomechanics
- "START DEMO →" — full width, green filled
- "Back" — ghost button, white text, dark border
- Footer note: "Demo data is not saved to your performance history" — info icon + muted text

**Nav bar:** Workout tab active (demo is accessed from workout flow)

---

## Screen States & Error Conditions

| Situation | Behavior |
|---|---|
| Confidence < 0.3 on critical keypoints | Show "Adjust camera angle" banner, pause error detection |
| No sessions in history | Stats screen shows empty state with CTA to start first session |
| Score = 100 | Badge shows "PERFECT REP", green ring fully filled |
| Score < 50 | Badge shows "POOR FORM", ring in #FF4444 |
| Demo mode | All analysis runs normally, session is NOT written to AsyncStorage |

---

## Navigation Flow Diagram

```
App Launch
    │
    ▼
Home Tab ──────────────────────────────────────────────────────┐
    │                                                           │
    │ [START DEADLIFT SESSION]                                  │
    ▼                                                           │
Workout Tab (Configure)                                         │
    │                                                           │
    │ [START SESSION →]                                         │
    ▼                                                           │
Live Session Screen                                             │
    │                                                           │
    │ [STOP SESSION] or auto-end                                │
    ▼                                                           │
Session Complete Screen                                         │
    │                                                           │
    │ [SAVE & CONTINUE]                                         │
    ▼                                                           │
Home Tab ◄─────────────────────────────────────────────────────┘

Demo Mode (accessible from Workout Tab):
Workout Tab → Demo Mode → Live Session (demo) → back to Workout Tab
```
