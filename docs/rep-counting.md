# Rep counting (deadlift FSM)

Rep counting runs **independently** from analyzer phase detection.  
Implementation: [`src/utils/deadliftRep.ts`](../src/utils/deadliftRep.ts) · Integration: [`LiveSessionScreen`](../src/screens/LiveSessionScreen.tsx) `ingestPose()`.

---

## Signal

- **Primary:** average left + right hip Y (`primaryHipY`) when both scores ≥ 0.1
- **Smoothing:** EMA on hip Y before FSM gates (`hipSmoothAlpha = 0.32`)
- **Coordinates:** portrait UI — Y increases downward; bottom of lift = **larger** Y; lockout = **smaller** Y

---

## Calibration

After countdown → `active`, the first **12 frames** sample hip Y.  
**Standing baseline** = **minimum** Y in that window (tallest posture).

All gates are relative to `standing`:

| Gate | Formula |
|------|---------|
| Lockout height | `standing + 0.014` (slack) |
| Return after rep | `standing + 0.030` (leaves lockout; **below** bottom gate) |
| Bottom (arm) | `standing + 0.055` |

---

## State machine

```
need_setup → need_lockout → COUNT → need_return → need_setup → …
```

| State | Entry condition |
|-------|-----------------|
| `need_setup` | After return, or session start |
| `need_lockout` | Hip Y > bottom gate for 3 frames; armed depth ≥ bottom + 0.016 |
| COUNT | Peak ascent ≥ 0.062; min hip Y ≤ lockout + **0.028**; ≥3 bottom frames; pose OK; 550 ms ≤ arm age ≤ **12 s** (22 s if slow ascent); **2** qualifying frames (or **1** if ascent ≥ 110% ROM) |
| `need_return` | After COUNT — return gate **or** touch-and-go bottom arm (fast descent) |
| **`stale_reset`** | Stuck at bottom 12 s+ (peak ascent &lt; 22% ROM), or cycle exhausted without a valid count |

**Re-arm:** If still in `need_lockout` but hips drop **0.028** below current armed depth (and past bottom gate), armed bottom refreshes (handles stuck shallow arms).

---

## Dev verification

1. `npm run log:session` + `npm run start:lan`
2. Run a set; compare your manual count to `rep COUNT` lines
3. Optional: `node scripts/eval-session-log.cjs --expected 5`

See [`effectiveness-evaluation.md`](effectiveness-evaluation.md).
