# Phase B — Form error pilot

Engineering pilot to verify **ERR_001–ERR_005** fire when you intentionally perform them, and that Session Complete records them correctly.

**Prerequisite:** Phase A passed (5/5 reps in slow, normal, fast tempos).

---

## Setup

**Terminal A**
```bash
npm run start:lan
```

**Terminal B**
```bash
npm run log:session
```

Reload the app on your phone. Optional — clear the log:
```powershell
"" | Out-File -FilePath logs\session-live.log -Encoding utf8
```

Configure **Workout → Deadlift → 3 reps** per set (short sets keep each error isolated).

---

## Test matrix (5 sets)

Do **one dedicated set per error**. Side camera, full body in frame, same lighting as Phase A.

| Set | Target error | How to provoke | Expected banner / audio |
|-----|--------------|----------------|-------------------------|
| 1 | **ERR_001** Lumbar rounding | Round upper back during pull; chest collapses | Red — *"Engage your lats. Drive chest up."* |
| 2 | **ERR_002** Hips too high | Start pull with hips shooting up before back angle sets | Red — *"Lower your hips. Set your back angle first."* |
| 3 | **ERR_003** Bar drift | Let bar swing forward mid-pull (away from shins) | Amber — *"Keep the bar close. Drag it up your legs."* |
| 4 | **ERR_004** Hyperextension | Lean back hard at lockout | Amber — *"Stand tall. Don't lean back at the top."* |
| 5 | **ERR_005** Shoulder behind bar | At bottom setup, shoulders clearly behind the bar | Amber — *"Shoulders over the bar. Shift weight forward."* |

**Set 6 (control):** 3 clean reps — expect **no** recorded errors and score **100**.

Between sets, tap **Continue workout** or start a new session so each set gets its own `lift_started` block in the log.

---

## What to verify on device

For each intentional-error set:

1. Live **banner** appears after ~3 analyzed frames (~0.4 s)
2. **Audio cue** plays (if audio on)
3. **Session Complete** shows the right form row:
   - ERR_001 / ERR_002 → **Hip Sway** CRITICAL
   - ERR_003 / ERR_004 / ERR_005 → **Range of Motion** WARNING
4. **Performance score** matches [`form-errors.md`](form-errors.md) weights (e.g. one critical → 75)

---

## Log analysis

After the run:

```bash
npm run eval:errors
```

Output per set:

- **Recorded** — errors persisted to session summary (`analyzer recorded` in log)
- **Live detections** — throttled frame hits (`analyzer detected`)

Compare rep counts still look sane:

```bash
npm run eval:session -- --expected 3
```

### Label spreadsheet

1. Copy `docs/phase-b-labels.template.csv` → `docs/phase-b-labels.csv`
2. Fill **expected** column: `Y` if you truly performed that error in that set, `N` for control set
3. Run:

```bash
npm run eval:errors -- --labels docs/phase-b-labels.csv
```

Target: **≥ 80% agreement** between your labels and **recorded** errors (see [`effectiveness-evaluation.md`](effectiveness-evaluation.md)).

---

## Log events (reference)

| Event | Meaning |
|-------|---------|
| `analyzer detected` | Frame-level hit (throttled ~1.2 s) |
| `analyzer recorded` | Saved to session after ≥3 consecutive frames — **use this for scoring** |
| `rep COUNT` | Rep FSM count |

---

## Known pitfalls

| Issue | Notes |
|-------|-------|
| ERR_005 during pull | Phase heuristics may label bottom frames as `setup` mid-set — note in labels if ambiguous |
| ERR_002 false positive | Only fires in `pull_initiation`; should not fire while standing between reps |
| No banner | Pose lost, low keypoint scores, or error not held 3 frames |
| Wrong score | Each `errorId` counted once per set summary, not per frame |

If a error never records despite visible bad form, note the set in your labels CSV and share `logs/session-live.log` for threshold tuning in `analyzer.ts`.

---

## Related

- [`form-errors.md`](form-errors.md) — thresholds & messages
- [`effectiveness-evaluation.md`](effectiveness-evaluation.md) — metrics definitions
- [`session-debug.md`](session-debug.md) — logging setup
