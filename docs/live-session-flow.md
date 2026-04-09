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
- Skeleton overlay renders in **muted gray (#5A5550)** — not yet detected
- No error detection, no rep counting
- Instruction banner shown center-bottom:
  - Icon: person (orange)
  - Title: "GET IN POSITION"
  - Body: "Stand sideways to the camera. Make sure your full body is in frame."
- Animated pulsing dots + "SEARCHING FOR POSE..." below banner

**Detection criteria to advance:**
All of these keypoints must have confidence > 0.3 simultaneously:
- LEFT_SHOULDER or RIGHT_SHOULDER (5 or 6)
- LEFT_HIP or RIGHT_HIP (11 or 12)
- LEFT_KNEE or RIGHT_KNEE (13 or 14)
- LEFT_ANKLE or RIGHT_ANKLE (15 or 16)

**If confidence too low:** Banner changes to amber (#F0C040):
- "ADJUST CAMERA ANGLE"
- "Move the device to capture your full body from the side."

**Top bar:** back arrow (←) | "DEADLIFT · SET 1" | audio toggle
**No nav bar. No logo. No STOP SESSION button.**

---

## State 7B — Position Detected (auto-transition)

**Trigger:** All critical keypoints reach confidence > 0.3.

**Duration:** ~800ms (brief confirmation before countdown)

**What happens:**
- Skeleton switches to full orange (#F08030) with glow
- Instruction banner changes to green confirmation:
  - Background: #0D2D16
  - Icon: check_circle green
  - Title: "POSITION OK" (#27C34F)
  - Body: "Hold still..." (muted)
- Auto-advances to 7C after 800ms

**If pose is lost during 7B:** Returns immediately to 7A.

---

## State 7C — Countdown

**Trigger:** Auto-transition from 7B after 800ms.

**Duration:** 3 seconds (3 → 2 → 1)

**What happens:**
- Skeleton stays orange
- Instruction banner replaced by large countdown ring:
  - 160px diameter circular ring
  - Conic gradient: #F08030 depleting clockwise each second
  - Number inside: DM Mono 700, 72px, #F0EDE8
  - Sequence: 3 → 2 → 1
- Below ring: "GET READY TO LIFT" (uppercase, muted, Space Grotesk)
- Each second: haptic feedback + audio beep
- At "1": final beep → transition to 7D

**If pose is lost during countdown:** Returns to 7A. Countdown resets.

---

## State 7D — Active Session

**Trigger:** Countdown reaches 0.

**What happens:**
- Stats panel slides up from bottom (animated)
- Skeleton fully orange, error detection activates
- Rep counter starts at 0
- All 5 biomechanical error checks run on every frame
- Error banners show when errors persist ≥ 3 consecutive frames
- Audio feedback throttled: max 1 cue per 2 seconds

**Stats panel (bottom):**
- 3 solid white cards (#F0EDE8 bg, #111010 text, 16px radius):
  - REP: DM Mono 700, 52px
  - SERIES: DM Mono 700, 52px
  - TIME: DM Mono 700, 52px, color #F08030
- STOP SESSION button below (full width, #E84040, only appears here)

**If pose is lost during 7D:**
- Rep counting PAUSES (does not reset)
- Banner: "POSE LOST — REPOSITION" (warning yellow)
- Skeleton reverts to muted gray
- When pose returns: auto-resumes WITHOUT restarting countdown
- Does NOT go back to 7A — user is mid-session

**Top bar:** back arrow (←) | "DEADLIFT · SET 2" | audio toggle

---

## Rep Detection Logic

A rep is counted when a full deadlift cycle completes:

```
setup → pull_initiation → mid_pull → lockout → descent → setup
```

- Hip Y-position relative to shoulder Y is the primary signal for phase
- Rep counter increments only at the transition: lockout → descent
- Partial reps (abandoned before lockout) do not count
- Between reps: skeleton stays orange, error detection continues

---

## Stop Session Modal

Triggered when user taps "STOP SESSION" in state 7D.

**Session PAUSES** while modal is visible (rep counting frozen, analysis frozen).

Modal content:
- Warning icon (red)
- Title: "End Session?"
- Body: "Your progress will be saved up to this point, but the current set will not be recorded."
- Summary card: "SET 2 · 5 REPS · 01:24" + "Completed sets are safe." (green)
- Buttons:
  - "KEEP GOING" (#222019 bg) — dismisses modal, resumes instantly
  - "END SESSION" (#E84040 bg) — ends session, navigates to Session Complete

Tapping overlay background = KEEP GOING (safe dismiss).

---

## Implementation Notes

```typescript
type LiveSessionState = 'positioning' | 'detected' | 'countdown' | 'active' | 'pose_lost';

// Keypoints required for valid pose
const REQUIRED_KEYPOINTS = [
  KEYPOINTS.LEFT_SHOULDER,  // or RIGHT
  KEYPOINTS.LEFT_HIP,       // or RIGHT
  KEYPOINTS.LEFT_KNEE,      // or RIGHT
  KEYPOINTS.LEFT_ANKLE,     // or RIGHT
];

const MIN_CONFIDENCE = 0.3;

function isPoseValid(pose: PoseResult): boolean {
  return REQUIRED_KEYPOINTS.every(kpIndex => {
    const left = pose.keypoints[kpIndex];
    const right = pose.keypoints[kpIndex + 1]; // right side is index + 1
    return left.score >= MIN_CONFIDENCE || right.score >= MIN_CONFIDENCE;
  });
}
```
