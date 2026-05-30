# Effectiveness evaluation

How to measure whether RepRight’s **rep counter** and **error detector** are good enough for the validation study (target: **≥ 80% agreement** with a certified trainer per README).

---

## 1. Rep counting accuracy

### Ground truth protocol (per session)

1. Start `npm run log:session` and `npm run start:lan`.
2. Do one set with a **known rep count** (e.g. 5 reps — count aloud or use a metronome).
3. Note: exercise, weight, camera side, lighting, continued vs new set.
4. Save `logs/session-live.log` (copy with date if you will overwrite).

### Metrics

| Metric | Definition |
|--------|------------|
| **Detected reps** | Number of `rep COUNT` lines in the log |
| **Absolute error** | `\|detected − ground_truth\|` |
| **Session accuracy** | `1 − |detected − GT| / GT` (cap at 0) |
| **Over-count rate** | Sessions where detected > GT |
| **Under-count rate** | Sessions where detected < GT |

**Study-level rep accuracy:** mean session accuracy across N sessions (target: ≥ 0.95 for engineering sign-off before field study).

### Quick CLI

```bash
node scripts/eval-session-log.cjs
node scripts/eval-session-log.cjs --expected 5
node scripts/eval-session-log.cjs --file logs/session-live.log --expected 8
```

Output includes COUNT timestamps, `armAgeMs`, and pass/fail vs expected count.

### What to inspect in logs when reps are wrong

| Symptom | Likely cause | Log clues |
|---------|--------------|-----------|
| Under-count | Lockout never confirmed | Stuck in `need_lockout`; no `COUNT`; hipY vs `lockoutTopY` |
| Over-count | Shallow re-arm | `phase:need_setup->need_lockout` with low `armed`; short `armAgeMs` |
| Stuck mid-set | False shallow arm | `rearm` missing; `armed` << previous rep depth |
| Lost after pose drop | Tracking gap | `active->pose_lost`; low keypoint scores |

---

## 2. Error detection accuracy

### Ground truth protocol

For **each rep** (or each 5 s clip), a rater (certified trainer) labels:

- Which of ERR_001–ERR_005 occurred (Y/N)
- Optional: phase when it occurred

Compare to app output:

- **Live:** `analyzer detected` lines in session log
- **Session summary:** errors stored in `sessionResultStore` → Session Complete / saved `SessionLog`

### Metrics (per error type)

| Metric | Formula |
|--------|---------|
| **Precision** | TP / (TP + FP) |
| **Recall** | TP / (TP + FN) |
| **F1** | 2 · P · R / (P + R) |
| **Agreement** | (TP + TN) / total labeled frames or reps |

**Study target (README):** ≥ **80% agreement** with trainer evaluations (aggregate across error types or per primary errors ERR_001/002).

### Practical batch size

- **Pilot:** 5 participants × 1 set × 5 reps = 25 reps labeled
- **Full study:** N = 15 per README

Use a simple spreadsheet:

| session_id | rep | trainer_ERR_001 | app_ERR_001 | … |
|------------|-----|-----------------|-------------|---|

---

## 3. Latency & runtime health

From session logs (`infer throughput`):

| Metric | Target | Log field |
|--------|--------|-----------|
| Inference FPS | ~7–11 Hz (throttled ~140 ms) | `infer throughput \| fps=` |
| Pose lost rate | Low during set | `flow active->pose_lost` count |
| Model fallback | None on device | `model mock_fallback` |

---

## 4. User-facing score validity

Session Complete score = `100 − Σ(unique error weights)` (see [`form-errors.md`](form-errors.md)).

**Sanity checks:**

- Clean set (no analyzer errors) → score 100
- One critical (ERR_001 or ERR_002) → 75
- ERR_005 only → 90

---

## 5. Recommended roadmap

| Phase | Goal | Actions |
|-------|------|---------|
| **A — Engineering** (now) | Rep counter stable | 10+ logged sets, `--expected` eval, tune `deadliftRep.ts` if needed |
| **B — Error pilot** | ERR_001/002/005 meaningful | Run [`phase-b-protocol.md`](phase-b-protocol.md); `npm run eval:errors`; adjust thresholds in `analyzer.ts` |
| **C — Field study** | Hypothesis 1–5 in README | 4-week protocol, AsyncStorage export, paired t-test |
| **D — Production** | Size & perf | EAS production AAB, latency spot-check on target devices |

---

## 6. Related docs

- [`form-errors.md`](form-errors.md) — full ERR_001–ERR_005 spec
- [`rep-counting.md`](rep-counting.md) — FSM thresholds
- [`session-debug.md`](session-debug.md) — wireless logging setup
- [`architecture.md`](architecture.md) — data flow overview
