# RepRight — Screen Inventory & Navigation Map (v3 FINAL)

## Navigation Structure

```
Bottom Tab Bar — 4 tabs, always visible on main screens:
├── [home]          Home
├── [fitness_center] Workout
├── [bar_chart]     Stats
└── [person]        Profile

Stack screens (no tab bar unless noted):
├── Demo Mode / Onboarding  (no nav — fixed footer CTAs)
├── Sign Up                 (no nav)
├── Login                   (no nav)
├── Email Confirmation      (has bottom nav on mobile)
├── Live Session 7A–7D      (NO nav bar, NO logo, NO STOP SESSION in header)
├── Stop Session Modal      (overlay on 7D)
└── Session Complete        (has bottom nav)
```

---

## Onboarding / Auth Screens (no bottom nav)

### Demo Mode / Onboarding
First screen a new user sees. Scrollable presentation of the app.

**Components:**
- Top: centered logo — fitness_center icon + "RepRight" Space Grotesk #27C34F
- Title: "DEMO MODE" uppercase, Space Grotesk Bold
- Subtitle: "Test the AI analysis without starting a real session" — Inter, muted
- Hero card: gym background image + SVG skeleton overlay in #27C34F + accuracy HUD
- Instructions card (3 steps, numbered 01/02/03):
  1. Position device 5–7 feet away, full-body profile view
  2. Execute your set — AI detects start/end automatically
  3. Receive instant feedback on depth, pathing, velocity
- Info note: "Demo data is not saved to your session history"
- **Fixed footer:** "START DEMO →" (primary green button) + "Back" (ghost)

### Sign Up
**Components:**
- Top: back arrow + "RepRight" wordmark + fitness_center icon right
- Title: "Create Account" Space Grotesk Bold 5xl
- Subtitle: muted Inter
- Form fields (bg: #131313, bottom border only, focus border #27C34F):
  - Full Name
  - Email Address
  - Password (eye toggle)
- CTA: "Sign Up →" full width green, rounded-xl
- Footer: "Already have an account? Log in" #27C34F link

### Login
**Components:**
- Top: back arrow + "RepRight" wordmark
- Title: "Welcome Back" Space Grotesk Bold
- Subtitle: "Log in to track your progress and hit your goals." muted
- Form fields (same style as Sign Up):
  - Email Address
  - Password + "Forgot password?" right-aligned #27C34F
- CTA: "Log In →" full width green
- Divider: "Or continue with"
- Social buttons: Google | Apple (2-col grid)
- Footer: "Don't have an account? Sign up" #27C34F

### Email Confirmation
**Components:**
- Top: fitness_center icon + "RepRight" centered
- Bottom nav visible on mobile
- Mail icon in dark rounded square (#262626)
- Title: "Verify Email" Space Grotesk Bold
- Subtitle: "We sent a code to your email."
- OTP input: 4–6 digit boxes (#131313 bg, bottom indicator border)
  - Active: #27C34F bottom line
  - Filled: #27C34F text
- CTA: "Verify & Continue →" full width green
- Resend link: "Didn't receive the code? Resend code" #27C34F
- Info cards: Encrypted (shield icon) | Expires soon (timer icon)

---

## Main App Screens (with bottom nav)

### Tab 1 — Home Screen

**Purpose:** Dashboard. Last session overview, quick start CTA, stats.

**Top bar:** #131313, bolt icon + "REPRIGHT" Space Grotesk Bold #27C34F
**Active tab:** Home (home icon, FILL=1, #27C34F + label)

**Components:**
- Greeting: "Good morning, Marcus" Space Grotesk Bold 4xl
- Subtitle: "Ready for your morning lift?" — uppercase, #ADAAAA
- CTA button: "START DEADLIFT SESSION ▶" — full width #27C34F, black text, rounded-xl, h-20
- Last Session card (#201F1F, rounded-xl):
  - "LAST SESSION" label + score badge (#27C34F pill)
  - "OCT 24 SUMMARY" heading
  - Sets: 4 | Reps: 8
  - fitness_center icon decoration (opacity 20%)
- Quick stats (2-col):
  - Total Sessions: 142 (#27C34F number)
  - Current Streak: 12 🔥 (#FFB800 fire icon)
- Recent Activity (2 items):
  - Left border: #27C34F if score good, #FF4444 if poor
  - Session name + date + performance %
- Weekly Volume mini chart: bars in #27C34F (active day), #262626 (others)

### Tab 2 — Configure Session (Workout Tab)

**Purpose:** Pre-session setup.

**Top bar:** bolt + "REPRIGHT" #27C34F (NOT a back arrow — this is a tab)
**Active tab:** Workout (fitness_center, FILL=1, #27C34F)

**Components:**
- Title: "CONFIGURE" Space Grotesk Bold 5xl tracking-tighter
- Subtitle: "Performance Session v2.4" uppercase muted
- Exercise selector (label: "SELECT EXERCISE"):
  - Deadlift (active): #201F1F bg, 4px left border #27C34F, check_circle #27C34F
    Label: "HIGH INTENSITY TRACKING" #27C34F uppercase
  - Squat (locked): 40% opacity, lock icon, "Coming soon"
  - Romanian Deadlift (locked): same
- Sets selector (label: "NUMBER OF SETS"):
  Pills [ 2 ] [ 3 ] [ 4 ] [ 5 ] — selected: #27C34F bg, black text, rounded-full
  Others: #201F1F bg, #ADAAAA text
- Info note: info icon (#27C34F) + "Reps will be counted automatically" Inter
- Stats preview (2-col cards): Last Performance kg | Recovery Level %
- **Fixed above nav:** "START SESSION →" full width #27C34F button

### Tab 3 — Stats / Rep Log

**Purpose:** Historical performance. Primary data for thesis study.

**Top bar:** bolt + "REPRIGHT" #27C34F
**Active tab:** Stats (bar_chart, FILL=1, #27C34F)

**Components:**
- Title: "REP LOG" Space Grotesk Bold large
- Subtitle: "Your biomechanical history" muted
- Filter pills: THIS WEEK | LAST WEEK | MONTHLY
  Active: #27C34F bg, black text. Inactive: #262626 bg, muted text.
- Peak Form Score card (#1A1919 bg):
  Large number in #27C34F, progress bar gradient
- Weekly Volume chart: 7 rounded bars M–S, active day #27C34F, others #262626
- Session list (Deadlift only):
  Each card (#201F1F bg, rounded-xl):
    Left border: #27C34F if score ≥70, #FF4444 if <70
    Date | sets × reps | score badge pill

### Tab 4 — Profile

**Purpose:** User info, study participation, settings.

**Top bar:** bolt + "REPRIGHT" #27C34F
**Active tab:** Profile (person, FILL=1, #27C34F)

**Components:**
- Avatar: circular, 2px border #27C34F, verified badge (check, #27C34F)
- Name Space Grotesk Bold + Participant ID pill (#27C34F text)
- Stats row (3-col): Best Form % | Sessions | Streak
- Study card (#002F0B bg, left border #27C34F):
  clinical_notes icon + "Study Participant · P001" + enrollment date
- Settings rows (#131313 bg each, rounded):
  - Notifications: toggle on (#27C34F)
  - Camera Prefs: chevron right
  - Units: "Metric" #27C34F + chevron
- Sign Out: full width, border #FF4444/40, text #FF4444
- Version: DM Mono small, #767575, centered

---

## Stack Screen — Live Session (4 internal states)

**NO bottom nav. NO logo in header. NO STOP SESSION in header.**

All 4 states share the same transparent top bar:
```
[←] back (circular #1A1919/80%)  |  "DEADLIFT · SET X" #ADAAAA  |  [🔊] audio
```

### State 7A — Positioning
- Skeleton: muted gray (#484847)
- Banner: "GET IN POSITION" — #1A1919 bg, #27C34F person icon
- Below: 3 pulsing dots (#27C34F) + "SEARCHING FOR POSE..." muted

### State 7B — Detected (~800ms auto)
- Skeleton: #27C34F with glow
- Banner: "POSITION OK" — #002F0B bg, check_circle #27C34F

### State 7C — Countdown
- Skeleton: #27C34F
- Countdown ring: 160px, conic-gradient #27C34F depleting
- Number: Space Grotesk Bold 72px white
- Label: "GET READY TO LIFT" uppercase muted

### State 7D — Active Analysis
- Skeleton: #27C34F (error keypoint → #FF4444 with drop-shadow glow)
- Status pill: green pulse dot + "TRACKING DEADLIFT" + accuracy %
- Error banner:
  - Critical: #FF4444 bg, white text
  - Warning: #FFB800 bg, dark text
- Stats panel (bottom, #131313 bg):
  - REP | SERIES | TIME cards — TIME is #27C34F
  - "STOP SESSION" full width below (#9F0519 or #FF4444, white text)

---

## Stack Screen — Stop Session Modal

Overlay on state 7D. Session pauses while visible.

- Overlay: rgba(0,0,0,0.8) + backdrop-blur
- Card: #1A1919 bg, 24px radius
- Warning icon: #FF4444
- Title: "End Session?"
- Body: progress warning text
- Summary: "SET 2 · 5 REPS · 01:24" + "Completed sets are safe." #27C34F
- Buttons:
  - "KEEP GOING" — #262626 bg (safe)
  - "END SESSION" — #FF4444 bg (destructive)

---

## Stack Screen — Session Complete

**Has bottom nav.** Workout tab shown (no active highlight needed).

**Components:**
- Header: centered logo (RepRight bolt wordmark) or close button left
- Title: "SESSION COMPLETE" Space Grotesk Bold uppercase
- Score ring: conic-gradient(#27C34F {score}%, #1A1919 0), inner #0D0D0D
  Score number large + "/100" muted + score label badge (ELITE PRECISION etc.)
- Stats 2×2 grid (#201F1F cards):
  VOLUME | SETS | TIME | AVG SCORE
- Form Adjustments Detected:
  Each row: colored left border + error name + severity badge
  Critical: #FF4444, Warning: #FFB800 (orange-ish), Good: #27C34F
- CTA: "SAVE & CONTINUE" full width #27C34F

---

## Screen States & Error Conditions

| Situation | Behavior |
|---|---|
| Confidence < 0.3 on keypoints | "ADJUST CAMERA ANGLE" banner (#FFB800) |
| No sessions in history | Stats shows empty state + CTA |
| Score = 100 | "PERFECT REP" label, ring fully #27C34F |
| Score < 50 | "POOR FORM" label, ring in #FF4444 |
| Demo mode | Analysis runs normally, NOT saved to AsyncStorage |
| Pose lost in 7D | Pauses, "POSE LOST" banner, auto-resumes |

---

## Navigation Flow

```
App Launch
    │
    ▼
Demo Mode / Onboarding ──── [Sign Up] ──── [Login]
    │                                           │
    │ [START DEMO →]                            │ [Log In]
    │                                           │
    ▼                                           ▼
Live Analysis (demo)                    Home Tab
    │                                           │
    │ back                                      │ [START DEADLIFT SESSION]
    ▼                                           ▼
Demo Mode                               Configure Session (Workout Tab)
                                                │
                                                │ [START SESSION →]
                                                ▼
                                        Live Session 7A → 7B → 7C → 7D
                                                │
                                                │ [STOP SESSION] → Modal
                                                │ [END SESSION]
                                                ▼
                                        Session Complete
                                                │
                                                │ [SAVE & CONTINUE]
                                                ▼
                                        Home Tab
```
