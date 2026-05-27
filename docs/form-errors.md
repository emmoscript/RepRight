# Form errors catalog (ERR_001–ERR_005)

Canonical reference for all biomechanical errors detected in **Live Session**.  
Implementation: [`src/modules/analyzer.ts`](../src/modules/analyzer.ts) · Feedback copy: [`src/modules/feedback.ts`](../src/modules/feedback.ts) · Scoring: [`src/modules/scoring.ts`](../src/modules/scoring.ts).

---

## Summary

| ID | Name | Severity | Active phase(s) | Score deduction |
|----|------|----------|-----------------|-----------------|
| ERR_001 | Lumbar rounding | **critical** | `pull_initiation`, `mid_pull` | −25 |
| ERR_002 | Hips too high at pull | **critical** | `pull_initiation` only | −25 |
| ERR_003 | Bar drift from body | warning | `mid_pull` | −10 |
| ERR_004 | Hyperextension at lockout | warning | `lockout` | −10 |
| ERR_005 | Shoulder behind bar (setup) | warning | `setup` | −10 |

Each unique `errorId` is counted **once per session summary** for scoring (not per frame).  
Live banners/audio require the error to persist **≥ 3 consecutive analyzed frames** (see Live Session).

---

## ERR_001 — Lumbar rounding

| Field | Value |
|-------|-------|
| **Severity** | Critical (red banner, white text, haptic) |
| **Phases** | `pull_initiation`, `mid_pull` |
| **Joint angle** | Shoulder → hip → knee (left chain) |
| **Threshold** | Angle **< 150°** → error |
| **Confidence** | `(150 − angle) / 30`, capped at 1 |

**Meaning:** Torso collapses or rounds during the pull — hip–shoulder–knee chain closes too much.

**User message:** *"Engage your lats. Drive chest up."*

**Session Complete mapping:** Form row **Hip Sway** → CRITICAL if ERR_001 or ERR_002 present.

---

## ERR_002 — Hips too high at initiation

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Phases** | `pull_initiation` **only** (not `setup` — avoids false positives while standing) |
| **Signal** | `shoulder.y − hip.y` (portrait: smaller Y = higher on screen) |
| **Threshold** | Diff **< 0.05** (hips too high relative to shoulders) |
| **Confidence** | `|diff − 0.05| / 0.1`, capped at 1 |

**Meaning:** Hips rise before the back angle is set — stiff-leg / high-hip start.

**User message:** *"Lower your hips. Set your back angle first."*

**Session Complete mapping:** Form row **Hip Sway** → CRITICAL if ERR_001 or ERR_002 present.

---

## ERR_003 — Bar drift away from body

| Field | Value |
|-------|-------|
| **Severity** | Warning (amber banner) |
| **Phases** | `mid_pull` |
| **Proxy** | Left wrist ≈ bar position (lateral view) |
| **Signal** | `\|wrist.x − ankle.x\|` (normalized frame width) |
| **Threshold** | **> 0.08** → error |
| **Confidence** | `(offset − 0.08) / 0.1`, capped at 1 |

**Meaning:** Bar path moves away from the legs mid-pull.

**User message:** *"Keep the bar close. Drag it up your legs."*

**Session Complete mapping:** Form row **Range of Motion** → WARNING if ERR_003, ERR_004, or ERR_005 present.

---

## ERR_004 — Hyperextension at lockout

| Field | Value |
|-------|-------|
| **Severity** | Warning |
| **Phases** | `lockout` |
| **Joint angle** | Hip → knee → ankle (left chain) |
| **Threshold** | Angle **< 160°** → error |
| **Confidence** | `(160 − angle) / 20`, capped at 1 |

**Meaning:** Excessive lean-back or incomplete leg extension at the top of the lift.

**User message:** *"Stand tall. Don't lean back at the top."*

**Session Complete mapping:** Form row **Range of Motion** → WARNING if ERR_003, ERR_004, or ERR_005 present.

---

## ERR_005 — Shoulder behind bar at setup

| Field | Value |
|-------|-------|
| **Severity** | Warning |
| **Phases** | `setup` |
| **Proxy** | Left shoulder vs left wrist (bar ≈ wrist) |
| **Signal** | `shoulder.x − wrist.x` (lateral view) |
| **Threshold** | Offset **> 0.05** (5% of frame width) → error |
| **Confidence** | `(offset − 0.05) / 0.1`, capped at 1 |

**Meaning:** Shoulders sit behind the bar at the bottom — poor start position.

**User message:** *"Shoulders over the bar. Shift weight forward."*

**Session Complete mapping:** Form row **Range of Motion** → WARNING if ERR_003, ERR_004, or ERR_005 present.

**Note:** This is the error most often logged in side-view sessions when phase heuristics label frames as `setup` during the pull.

---

## Phase detection (context for errors)

Phases are inferred from **left hip Y** relative to shoulder–ankle body height plus vertical motion (`detectPhase` in `analyzer.ts`):

| Phase | Heuristic (simplified) |
|-------|-------------------------|
| `setup` | Hip low in frame (`hipRelative < 0.35`) |
| `pull_initiation` | Hip rising, `0.35–0.55` |
| `mid_pull` | Hip rising, `0.55–0.75` |
| `lockout` | Hip high (`≥ 0.75`) |
| `descent` | Hip moving down |
| `unknown` | Low confidence or ambiguous motion |

Rep counting uses a **separate FSM** (hip Y baseline + ROM gates) — see [`docs/rep-counting.md`](rep-counting.md).

---

## Feedback & scoring rules

| Rule | Value |
|------|-------|
| Banner persistence | ≥ 3 consecutive frames with same error |
| Audio throttle | Max 1 spoken cue / 2 s |
| Priority | Critical before warning; then higher confidence |
| Per-rep score | `100 − Σ(unique error weights)`; floor 0 |
| Score bands | ≥90 Excellent · ≥70 Good · ≥50 Needs Work · else Poor |

---

## Dev logging

When `npm run log:session` is active, analyzer hits appear as:

```text
[timestamp] analyzer  detected | phase=setup errors=["ERR_005"]
```

See [`session-debug.md`](session-debug.md).
