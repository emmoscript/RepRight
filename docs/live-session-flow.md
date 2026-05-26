# RepRight — Live Session Detection Flow

## Overview

Before rep counting and biomechanical analysis begin, the app runs a
**positioning validation flow** to ensure the user is correctly in frame
and the pose can be reliably detected. This prevents false positives and
ensures analysis only starts when conditions are optimal.

---

## The 4 States

```
7A POSITIONING → 7B DETECTED → 7C COUNTDOWN → 7D ACTIVE SESSION
     ↑                │               │
     └────────────────┘ (pose lost)   │
     └──────────────────────────────── (pose lost → pause, not restart)
```

---

## State 7A — Positioning

**Trigger:** User taps "START SESSION" on Configure Session screen.

**What happens:**
- Camera activates immediately
- MoveNet runs inference on every frame
- Skeleton overlay renders in **muted gray (#484847)** — not yet detected
- No error detection, no rep counting
- Instruction banner shown center-bottom:
  - Icon: person (#27C34F)
  - Title: "GET IN POSITION"
  - Body: "Stand sideways to the camera. Make sure your full body is in frame."
- Animated pulsing dots (#27C34F) + "SEARCHING FOR POSE..." below banner

**Detection criteria to advance:**
All of these keypoints must have confidence > 0.3 simultaneously:
- LEFT_SHOULDER or RIGHT_SHOULDER (5 or 6)
- LEFT_HIP or RIGHT_HIP (11 or 12)
- LEFT_KNEE or RIGHT_KNEE (13 or 14)
- LEFT_ANKLE or RIGHT_ANKLE (15 or 16)

**If confidence too low:** Banner changes to amber (#FFB800):
- "ADJUST CAMERA ANGLE"
- "Move the device to capture your full body from the side."

**Top bar:** back arrow (←) | "DEADLIFT · SET 1" | audio toggle
**No nav bar. No logo. No STOP SESSION button.**

---

## State 7B — Position Detected (auto-transition)

**Trigger:** All critical keypoints reach confidence > 0.3.

**Duration:** ~800ms (brief confirmation before countdown)

**What happens:**
- Skeleton switches to full green (#27C34F) with glow:
  drop-shadow(0 0 8px rgba(39,195,79,0.4))
- Instruction banner changes to green confirmation:
  - Background: #002F0B (green subtle)
  - Icon: check_circle #27C34F
  - Title: "POSITION OK" (#27C34F)
  - Body: "Hold still..." (#ADAAAA muted)
- Auto-advances to 7C after 800ms

**If pose is lost during 7B:** Returns immediately to 7A.

---

## State 7C — Countdown

**Trigger:** Auto-transition from 7B after 800ms.

**Duration:** 3 seconds (3 → 2 → 1)

**What happens:**
- Skeleton stays green (#27C34F)
- Instruction banner replaced by large countdown ring:
  - 160px diameter circular ring
  - Conic gradient: #27C34F depleting clockwise each second
  - Number inside: Space Grotesk Bold, 72px, #FFFFFF
  - Sequence: 3 → 2 → 1
- Below ring: "GET READY TO LIFT" (uppercase, #767575, Space Grotesk)
- Each second: haptic feedback + audio beep
- At "1": final beep → transition to 7D

**If pose is lost during countdown:** Returns to 7A. Countdown resets.

---

## State 7D — Active Session

**Trigger:** Countdown reaches 0.

**What happens:**
- Stats panel slides up from bottom (animated)
- Skeleton fully green (#27C34F), error detection activates
- Rep counter starts at 0
- All 5 biomechanical error checks run on every frame
- Error banners show when errors persist ≥ 3 consecutive frames
- Audio feedback throttled: max 1 cue per 2 seconds

**Stats panel (bottom, #131313 bg, top radius 24px):**
- 3 stat cards side by side (#201F1F bg, backdrop-blur):
  - REP:    Space Grotesk Bold, 48px, #FFFFFF
  - SERIES: Space Grotesk Bold, 48px, #FFFFFF
  - TIME:   Space Grotesk Bold, 48px, #27C34F
- STOP SESSION button below:
  - Background: #9F0519 (error-container) or #FF4444
  - Text: white, Space Grotesk Bold, uppercase
  - Full width, rounded-xl
  - **ONLY appears here — no other screen has STOP SESSION**

**If pose is lost during 7D:**
- Rep counting PAUSES (does not reset)
- Banner: "POSE LOST — REPOSITION" (#FFB800 amber)
- Skeleton reverts to muted gray (#484847)
- When pose returns: auto-resumes WITHOUT restarting countdown
- Does NOT go back to 7A — user is mid-session

**Top bar (transparent):** back arrow (←) | "DEADLIFT · SET 2" | audio toggle

---

## Error Banners (State 7D)

```
Critical (ERR_001, ERR_002):
  Background: #FF4444 (error red), text: #FFFFFF
  Icon: warning (filled), "AI LIVE FEEDBACK" 10px uppercase

Warning (ERR_003, ERR_004, ERR_005):
  Background: #FFB800 (amber), text: #0D0D0D (dark)
  Icon: warning, same label format
```

---

## Rep Detection Logic

Rep counting uses a **hip-Y state machine** (baseline at session start, bottom arm, ROM lockout, return gate) — **not** analyzer phase transitions.

See [`rep-counting.md`](rep-counting.md) and evaluate with [`effectiveness-evaluation.md`](effectiveness-evaluation.md).

```
need_setup → need_lockout → COUNT → need_return → …
```

- Primary signal: smoothed average hip Y (both hips when visible)
- Partial reps (no lockout ROM) do not increment the counter
- `pose_lost` pauses tracking but does **not** reset rep FSM progress

---

## Stop Session Modal

Triggered when user taps "STOP SESSION" in state 7D.

**Session PAUSES** while modal is visible.

Modal content (#1A1919 bg, 24px radius, centered):
- Warning icon (#FF4444, 40px, filled)
- Title: "End Session?" Space Grotesk Bold, #FFFFFF
- Body: "Your progress will be saved up to this point, but the current set
  will not be recorded." Inter, #ADAAAA
- Summary card (#262626 bg):
  "SET 2 · 5 REPS · 01:24" + "Completed sets are safe." (#27C34F)
- Buttons (stacked):
  - "KEEP GOING" — #262626 bg, #FFFFFF text (safe — natural thumb position)
  - "END SESSION" — #FF4444 bg, #FFFFFF text (destructive)

Tapping overlay background = KEEP GOING (safe dismiss).

---

## Implementation Notes

```typescript
type LiveSessionState =
  | 'positioning'
  | 'detected'
  | 'countdown'
  | 'active'
  | 'pose_lost';

// Keypoints required for valid pose (either side works)
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

// Skeleton colors by state
const SKELETON_COLORS = {
  positioning: '#484847',   // muted gray
  detected:    '#27C34F',   // green with glow
  countdown:   '#27C34F',
  active:      '#27C34F',
  pose_lost:   '#484847',   // reverts to muted
  error_joint: '#FF4444',   // error keypoint override
};
```
