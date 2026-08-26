# Gym field pose stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce gym-session pose loss from background people (UX only) and stop knee/ankle keypoints from jumping backward during descent occlusion, so rep counting survives plate/torso occlusion without freezing hips/shoulders or swapping MoveNet.

**Architecture:** Keep MoveNet Lightning and the inference worklet unchanged. After `mapPoseToPreviewSpace`, run a small lower-body anchor on indices 13–16 (knees/ankles). High-confidence detections update the anchor (`observed`). Low-confidence or jumping detections reuse the last good position for a short time (`predicted`, lower score). Overlay and the lift-tracking validity gate consume the stabilized pose; form errors must not treat predicted knees as fully observed. Background-person failures stay a capture/UX problem — static copy on configure + search + pose-lost, no multi-person model.

**Tech Stack:** React Native 0.76 / Expo bare, TypeScript, Zustand unchanged, Jest (`npm test`), i18n `src/i18n/locales/{en,es}.json`.

## Global Constraints

- Do **not** change MoveNet, TFLite, frame-processor throttle, or `src/utils/modelFrameCoords.ts` Y mapping.
- Do **not** implement multi-pose / person tracking / background subtraction.
- Do **not** lower global `MIN_KEYPOINT_SCORE` (0.3) as the fix.
- Do **not** freeze hips, shoulders, or wrists — those drive ERR_001–005.
- Do **not** invent `filterByConfidence()`, `movenet-rules.md`, or `api-contracts.md` — they are not in this repo.
- Inference is **~7 fps** (`INFER_INTERVAL_MS` 140 iOS / 180 Android in `src/components/LiveSessionCameraPipeline.tsx`), not 30 fps. Holds must be **time-based (ms)**, not “15 frames at 30 fps”.
- Predicted keypoints must be distinguishable from observed (`source: 'predicted'`) and must **not** reuse a high observed score.
- Do not commit unless the user explicitly asked for a commit.

## Confirmed before implementation

- Predicted score **0.22** + `source: 'predicted'`; analyzer ignores predicted knees for ERR_001/004.
- Hold is **700 ms** (time), not 15 frames. Calibrate to 900–1000 ms from gym videos if the bottom pause is longer.
- Ankles hold x,y; knees hold X and allow Y when score is usable.
- Search/countdown `isPoseValid` does **not** accept predicted knees. That matches today (search already needs a real knee). If the user starts already hinged with plates covering the legs, the session still will not leave search — field-test that countdown usually sees standing legs. Copy now tells them to stand so knees are visible before the first pull. Do not add a `pose.score < 0.4` banner.

---

## Cursor agent prompt (paste if starting a fresh session)

```text
Implement docs/superpowers/plans/2026-08-24-gym-field-pose-stability.md against the RepRight repo.

Field bugs from gym videos:
1) Background people steal MoveNet SinglePose → UX warnings only.
2) On descent/setup, occluded knees/ankles hallucinate behind the plates → legs “fly backward” and reps stop counting.

Reality of this codebase (do not contradict):
- MoveNet always emits 17 {x,y,score}. Nothing is null. “Loss” is consumer score gates.
- Rep FSM uses hip Y (`deadliftRep.ts`). COUNT is gated on `isPoseStableForLiftTracking` (hips AND knees ≥ 0.18) in LiveSessionScreen. That is why occlusion of knees drops reps.
- Overlay `groupOrchestratedFill` + `groupTriggerScore={0.22}` draws raw low-score leg coords → flying skeleton.
- No filterByConfidence. Insert stabilizer AFTER mapPoseToPreviewSpace, BEFORE ingestPose.
- Camera-height / tripod guidance is REJECTED: phone-on-any-surface is a product goal. Temporal ankle/knee hold is the chosen technical fix.

Follow the plan tasks in order. Do not skip tests. Do not freeze hip/shoulder.
```

---

## Spec corrections vs the field brief

The field brief is the product intent. These points replace incorrect assumptions so the implementer does not fight the real pipeline.

| Brief assumption | Repo reality | What to do |
|---|---|---|
| `filterByConfidence(keypoints, 0.3)` | Never existed. Each consumer has its own cutoff (`isPoseValid` 0.2, lift-track 0.18, overlay 0.3 / group-fill 0.22, analyzer knees 0.12 / lumbar 0.25). | Stabilize pose once, then let existing consumers run. |
| `MAX_HOLD_FRAMES = 15` ≈ 0.5 s at 30 fps | Inference ~7 fps → 15 frames ≈ **2.1 s**. State tick is 100 ms. | `maxHoldMs = 700`. |
| Emit held point at score `0.3` | `0.3` is `MIN_KEYPOINT_SCORE` — overlay/analyzer treat it as observed. Lumbar rounding needs knee ≥ 0.25. Frozen lockout knee + dropping hip **false-positives ERR_001**. | Predicted score cap **0.22** + `source: 'predicted'`. Analyzer must ignore predicted knees for reliability gates. Validity (`0.18`) still accepts 0.22 so COUNT can proceed. |
| Freeze knee x and y equally | Ankles are planted (x,y hold is safe). Knees **flex** (Y changes more than 3% of frame). “Flying backward” is mostly **posterior X**. | Ankles: hold x,y. Knees: hold **X** strictly; allow Y through if raw score ≥ 0.3 and ΔY is plausible, otherwise hold Y too for the short window. |
| New banner when `pose.score < 0.4` | `PoseResult.score` is the mean of all 17 keypoints. Plate occlusion also drops the mean → banner would fire on Problem 2. | **Do not** add a mean-score banner. Extend search + pose-lost copy instead. |
| Docs `movenet-rules.md` / `api-contracts.md` | Missing. Use `docs/architecture.md`, `docs/live-session-flow.md`, `docs/rep-counting.md`. | Do not create those filenames unless asked. |

### Pipeline insertion point

```
TFLite → keypointsFromMovenetOutput
      → mapPoseToPreviewSpace          // portrait preview coords
      → stabilizeLowerBodyPose         // NEW, knees/ankles only
      → ingestPose                     // validity, hip FSM, analyzer, setUiPose
      → SkeletonOverlay
```

Keep a ref of track state on `LiveSessionScreen`. Reset it when leaving the screen / starting a new set countdown→active is **not** required (countdown standing pose should **seed** anchors before the first pull).

---

## Files

| File | Role |
|---|---|
| Create `src/utils/lowerBodyTrack.ts` | Anchor state + `stabilizeLowerBodyPose` |
| Create `__tests__/lowerBodyTrack.test.ts` | Hold / timeout / score / knee-X vs ankle |
| Modify `src/modules/movenet.ts` | Optional `source` on `KeyPoint` |
| Modify `src/screens/LiveSessionScreen.tsx` | Run stabilizer after mapping; reset state |
| Modify `src/utils/poseValidation.ts` | Lift-track: predicted knee counts if hip observed |
| Modify `src/modules/analyzer.ts` | Predicted knee/ankle not “reliable” for ERR_001/004 |
| Modify `src/components/SkeletonOverlay.tsx` | Mute predicted joints (no high-confidence green) |
| Modify `src/screens/DeadliftConfigureScreen.tsx` | Pre-session capture tip |
| Modify `src/i18n/locales/en.json` and `es.json` | Copy |
| Modify `src/screens/LiveSessionScreen.tsx` | Search body + pose-lost subtitle |

---

### Task 1: Pre-session and in-session copy (background people)

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/screens/DeadliftConfigureScreen.tsx`
- Modify: `src/screens/LiveSessionScreen.tsx` (pose-lost banner only)

**Interfaces:**
- Consumes: existing `useTranslation` / `t('…')`
- Produces: keys listed below

**Copy (use these strings, both locales):**

`deadliftConfigure.captureTipsTitle`
- EN: `Camera tips`
- ES: `Consejos de cámara`

`deadliftConfigure.captureTipsBody`
- EN: `Side view, full body in frame. Keep other people from walking behind you — the pose model tracks one person and can jump to someone in the background.`
- ES: `Vista lateral, cuerpo completo en cuadro. Evita que otras personas pasen detrás — el modelo sigue a una sola persona y puede saltar a alguien del fondo.`

`liveSession.getInPositionBody` (replace existing)
- EN: `Stand sideways with your full body in frame. Clear the background — people walking behind you can steal the pose.`
- ES: `Párate de lado con el cuerpo completo en cuadro. Deja el fondo libre — si alguien camina detrás, el modelo puede perderte.`

`liveSession.poseLostDetail` (new)
- EN: `Step back in frame. If people are walking behind you, wait until the background is clear.`
- ES: `Vuelve al cuadro. Si hay gente caminando detrás, espera a que el fondo esté despejado.`

- [ ] **Step 1: Add i18n keys** in `en.json` / `es.json` under `deadliftConfigure` and `liveSession` as above. Keep `liveSession.poseLost` title unchanged.

- [ ] **Step 2: Configure screen tip**

In `DeadliftConfigureScreen.tsx`, above `footerNote` (before `START SESSION`), add a compact tip block using existing tokens (`colors.surface_v3`, `colors.text_muted`, `typography`). No new icon library. Example structure:

```tsx
<View style={styles.captureTips}>
  <Text style={styles.captureTipsTitle}>
    {t("deadliftConfigure.captureTipsTitle")}
  </Text>
  <Text style={styles.captureTipsBody}>
    {t("deadliftConfigure.captureTipsBody")}
  </Text>
</View>
```

Styles: `marginTop: 16`, padding 14, `borderRadius: 14`, `backgroundColor: colors.surface_v3`, title caption-caps muted, body `colors.text_secondary` / `typography.fontSize.body`.

Do **not** mention tripods or “raise the phone to hip height”. Versatility = phone on any gym surface.

- [ ] **Step 3: Search HUD** already uses `t('liveSession.getInPositionBody')` (~line 1702). Updating the string is enough.

- [ ] **Step 4: Pose-lost subtitle**

Replace the pose-lost banner (~1756) so the existing title stays and the new detail sits under it:

```tsx
<View style={[styles.infoBanner, styles.infoBannerPoseLost]}>
  <SvgHudWarnTriangle color={colors.accent_yellow} size={22} />
  <View style={{ flex: 1 }}>
    <Text style={styles.infoBannerPoseLostTitle}>{t('liveSession.poseLost')}</Text>
    <Text style={styles.infoBannerBody}>{t('liveSession.poseLostDetail')}</Text>
  </View>
</View>
```

If `infoBannerPoseLostTitle` currently assumes a single child, keep layout: icon + column. Do not add a `pose.score < 0.4` detector.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`

Expected: PASS.

Manual: configure screen shows the tip; live search text mentions background people; pose-lost shows the extra line.

---

### Task 2: Lower-body track unit tests (TDD)

**Files:**
- Create: `__tests__/lowerBodyTrack.test.ts`
- Create: `src/utils/lowerBodyTrack.ts` (empty exports first if needed so the test file compiles against the intended API)

**Interfaces:**
- Produces: `LOWER_BODY_TRACK`, `createLowerBodyTrackState`, `stabilizeLowerBodyPose` as specified in Task 3

- [ ] **Step 1: Write failing tests**

```ts
import { KEYPOINTS, type PoseResult } from '@/modules/movenet';
import {
  createLowerBodyTrackState,
  stabilizeLowerBodyPose,
  LOWER_BODY_TRACK,
} from '@/utils/lowerBodyTrack';

function kp(x: number, y: number, score: number, source?: 'observed' | 'predicted') {
  return source ? { x, y, score, source } : { x, y, score };
}

function poseAt(
  knee: { x: number; y: number; score: number },
  ankle: { x: number; y: number; score: number },
  ts = 0,
): PoseResult {
  const keypoints = Array.from({ length: 17 }, () => kp(0.4, 0.4, 0.8));
  keypoints[KEYPOINTS.LEFT_KNEE] = kp(knee.x, knee.y, knee.score);
  keypoints[KEYPOINTS.RIGHT_KNEE] = kp(knee.x + 0.02, knee.y, knee.score);
  keypoints[KEYPOINTS.LEFT_ANKLE] = kp(ankle.x, ankle.y, ankle.score);
  keypoints[KEYPOINTS.RIGHT_ANKLE] = kp(ankle.x + 0.02, ankle.y, ankle.score);
  return { keypoints, score: 0.7, timestamp: ts };
}

describe('stabilizeLowerBodyPose', () => {
  it('updates the anchor on high-confidence detections (observed)', () => {
    let state = createLowerBodyTrackState();
    const raw = poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 });
    const out = stabilizeLowerBodyPose(raw, state, 1000);
    const knee = out.pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source ?? 'observed').toBe('observed');
    expect(knee.x).toBeCloseTo(0.32);
    expect(knee.score).toBe(0.9);
    state = out.state;
  });

  it('holds last ankle position when score collapses (predicted, capped score)', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    const seen = poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 });
    state = stabilizeLowerBodyPose(seen, state, t0).state;

    const occluded = poseAt(
      { x: 0.12, y: 0.55, score: 0.12 },
      { x: 0.08, y: 0.4, score: 0.1 },
    );
    const out = stabilizeLowerBodyPose(occluded, state, t0 + 200);
    const ankle = out.pose.keypoints[KEYPOINTS.LEFT_ANKLE];
    expect(ankle.source).toBe('predicted');
    expect(ankle.x).toBeCloseTo(0.31);
    expect(ankle.y).toBeCloseTo(0.92);
    expect(ankle.score).toBe(LOWER_BODY_TRACK.predictedScore);
    expect(ankle.score).toBeLessThan(LOWER_BODY_TRACK.observeMin);
  });

  it('rejects a large posterior knee jump even if mid-confidence', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const jumped = poseAt(
      { x: 0.12, y: 0.72, score: 0.35 },
      { x: 0.31, y: 0.92, score: 0.88 },
    );
    const knee = stabilizeLowerBodyPose(jumped, state, t0 + 100).pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source).toBe('predicted');
    expect(knee.x).toBeCloseTo(0.32);
  });

  it('allows knee Y to change when score is usable and X stays near the anchor', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.62, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const flexed = poseAt(
      { x: 0.33, y: 0.78, score: 0.42 },
      { x: 0.31, y: 0.92, score: 0.7 },
    );
    const knee = stabilizeLowerBodyPose(flexed, state, t0 + 120).pose.keypoints[KEYPOINTS.LEFT_KNEE];
    expect(knee.source ?? 'observed').toBe('observed');
    expect(knee.y).toBeCloseTo(0.78);
    expect(knee.x).toBeCloseTo(0.33);
  });

  it('stops holding after maxHoldMs and passes raw through', () => {
    let state = createLowerBodyTrackState();
    const t0 = 1000;
    state = stabilizeLowerBodyPose(
      poseAt({ x: 0.32, y: 0.72, score: 0.9 }, { x: 0.31, y: 0.92, score: 0.88 }),
      state,
      t0,
    ).state;

    const occluded = poseAt(
      { x: 0.1, y: 0.4, score: 0.08 },
      { x: 0.1, y: 0.4, score: 0.08 },
    );
    const out = stabilizeLowerBodyPose(occluded, state, t0 + LOWER_BODY_TRACK.maxHoldMs + 50);
    const ankle = out.pose.keypoints[KEYPOINTS.LEFT_ANKLE];
    expect(ankle.source ?? 'observed').not.toBe('predicted');
    expect(ankle.x).toBeCloseTo(0.1);
    expect(ankle.score).toBeCloseTo(0.08);
  });

  it('does not modify hips or shoulders', () => {
    const raw = poseAt({ x: 0.32, y: 0.72, score: 0.2 }, { x: 0.31, y: 0.92, score: 0.2 });
    raw.keypoints[KEYPOINTS.LEFT_HIP] = kp(0.41, 0.51, 0.91);
    raw.keypoints[KEYPOINTS.LEFT_SHOULDER] = kp(0.39, 0.28, 0.93);
    const out = stabilizeLowerBodyPose(raw, createLowerBodyTrackState(), 0);
    expect(out.pose.keypoints[KEYPOINTS.LEFT_HIP]).toEqual(raw.keypoints[KEYPOINTS.LEFT_HIP]);
    expect(out.pose.keypoints[KEYPOINTS.LEFT_SHOULDER]).toEqual(
      raw.keypoints[KEYPOINTS.LEFT_SHOULDER],
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=lowerBodyTrack`

Expected: FAIL (module missing or exports missing).

---

### Task 3: Implement `stabilizeLowerBodyPose`

**Files:**
- Create: `src/utils/lowerBodyTrack.ts`
- Modify: `src/modules/movenet.ts` (`KeyPoint` optional `source`)

**Interfaces:**
- Consumes: `PoseResult`, `KeyPoint`, `KEYPOINTS` from `@/modules/movenet`
- Produces:

```ts
export const LOWER_BODY_TRACK = {
  observeMin: 0.5,
  holdRawFloor: 0.3,
  jitterMax: 0.03,
  maxHoldMs: 700,
  predictedScore: 0.22,
} as const;

export type LowerBodyTrackState = { /* opaque; create via factory */ };

export function createLowerBodyTrackState(): LowerBodyTrackState;

export function stabilizeLowerBodyPose(
  pose: PoseResult,
  state: LowerBodyTrackState,
  nowMs: number,
): { pose: PoseResult; state: LowerBodyTrackState };
```

- [ ] **Step 1: Extend `KeyPoint`** in `src/modules/movenet.ts`:

```ts
export type KeypointSource = 'observed' | 'predicted';

export interface KeyPoint {
  y: number;
  x: number;
  score: number;
  /** Absent or `observed` = MoveNet detection. `predicted` = temporal hold. */
  source?: KeypointSource;
}
```

- [ ] **Step 2: Implement `src/utils/lowerBodyTrack.ts`**

Indices: `LEFT_KNEE`, `RIGHT_KNEE`, `LEFT_ANKLE`, `RIGHT_ANKLE` only.

Per keypoint, clone state (do not mutate the incoming `state` object; return a new one) so tests stay simple.

Logic per index `i`:

1. If `raw.score >= observeMin` → emit raw with `source: 'observed'`, store anchor `{x,y, lastObservedAt: nowMs}`.
2. Else if no anchor → emit raw (no `predicted`); optionally seed a weak anchor only when `raw.score >= holdRawFloor` (do not seed from score 0.1 garbage).
3. Else if `nowMs - lastObservedAt > maxHoldMs` → emit raw, do not mark predicted (timeout / lost).
4. Else knees (`LEFT_KNEE` / `RIGHT_KNEE`):
   - If `raw.score >= holdRawFloor` AND `abs(raw.x - anchor.x) < jitterMax` → emit raw as observed (Y may move; this is flexion). Update lastObservedAt. Optionally update anchor to raw (so Y tracks) while keeping X close.
   - Else → emit `{ x: anchor.x, y: raw.score >= holdRawFloor ? raw.y : anchor.y, score: predictedScore, source: 'predicted' }`. If even Y is untrusted (`score < holdRawFloor`), use `anchor.y`.
5. Else ankles:
   - If `raw.score >= holdRawFloor` AND hypot(dx,dy) < jitterMax → emit raw observed.
   - Else → emit `{ ...anchor, score: predictedScore, source: 'predicted' }`.

Copy all other keypoints unchanged. Recompute `pose.score` as mean of the **emitted** keypoint scores (or leave original mean — pick one and keep it; prefer leaving original `pose.score` so a mean-based UX is not silently changed). Keep `timestamp`.

- [ ] **Step 3: Run tests**

Run: `npm test -- --testPathPattern=lowerBodyTrack`

Expected: PASS.

- [ ] **Step 4: Run existing tests**

Run: `npm test`

Expected: PASS (optional `source` must not break `poseValidation` / `analyzer` tests).

---

### Task 4: Wire stabilizer into live session + validity + overlay + analyzer

**Files:**
- Modify: `src/screens/LiveSessionScreen.tsx`
- Modify: `src/utils/poseValidation.ts`
- Modify: `src/modules/analyzer.ts`
- Modify: `src/components/SkeletonOverlay.tsx`
- Modify: `__tests__/poseValidation.test.ts`

**Interfaces:**
- Consumes: `stabilizeLowerBodyPose`, `createLowerBodyTrackState` from Task 3
- Produces: overlay + ingest see stabilized pose; predicted knees keep lift-tracking valid; ERR_001/004 ignore predicted knees

- [ ] **Step 1: Validity — predicted knee is enough during tracking**

In `isPoseStableForLiftTracking`, treat a knee as OK if `score >= LIFT_TRACK_MIN_SCORE` **or** `source === 'predicted'` (predicted score is 0.22 > 0.18, so score alone may already pass; still check `source` so a future cap cannot break it).

Hips must still be observed-quality (`score >= 0.18` and `source !== 'predicted'` — hips are never predicted today).

Add a test in `__tests__/poseValidation.test.ts`: hips 0.5, knees `source: 'predicted'` score 0.22 → `isPoseStableForLiftTracking` true. Hips 0.05, predicted knees → false.

`isPoseValid` (search/countdown) should **not** treat predicted as ready-to-start. Search should wait for real knees so anchors seed from a real standing pose. Import `isPoseStableForLiftTracking` in the test file if it is not already.

- [ ] **Step 2: Analyzer — predicted knee/ankle is not reliable**

In `lumbarChainReliableForRounding` and `leanbackChainReliableForHyperextension`, if the chosen knee has `source === 'predicted'`, return false.

In `checkBarDrift`, if the ankle used is `predicted`, ignore `ankleOffset` and use hip-only (frozen ankle X is usually fine, but do not invent bar-drift from a held point vs a moving wrist). Safer: skip ankle term when `ankle.source === 'predicted'`.

Do not freeze or rewrite shoulder/hip in the analyzer.

- [ ] **Step 3: Overlay mute for predicted**

In `SkeletonOverlay.tsx` `confidenceColor` / point opacity path: if `k.source === 'predicted'`, draw muted (use the low-tier color / opacity 0.45), never the green high-confidence stroke.

Do not skip drawing predicted points — holding them is what stops “legs flying backward”. Group-fill will now use anchored coordinates, which is correct.

- [ ] **Step 4: LiveSessionScreen wiring**

Add:

```ts
const lowerBodyTrackRef = useRef(createLowerBodyTrackState());
```

Reset `lowerBodyTrackRef.current = createLowerBodyTrackState()` when the screen unmounts or when `flow` goes from non-session to `search` at mount. Do **not** reset on `countdown` → `active`.

Apply in both real and mapped ingest paths. Today `applyModelOutput` does:

```ts
const raw = keypointsFromMovenetOutput(out, ts);
ingestPose(mapInferencePose(raw, frameOrientation, frameMeta));
```

Change to a small helper used by inference **and** mock interval:

```ts
const stabilizeMapped = (mapped: PoseResult) => {
  const { pose, state } = stabilizeLowerBodyPose(
    mapped,
    lowerBodyTrackRef.current,
    Date.now(),
  );
  lowerBodyTrackRef.current = state;
  return pose;
};

ingestPose(stabilizeMapped(mapInferencePose(raw, frameOrientation, frameMeta)));
```

Find the mock `ingestPose(getMockPose(...))` path and run mock poses through the same stabilize (or map then stabilize). Mock scores are high; hold should be a no-op.

Never stabilize in the worklet.

- [ ] **Step 5: Verify**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: PASS.

---

## Acceptance

- [ ] Configure session shows camera tips including background people. No tripod / “raise to hip height” copy.
- [ ] Search HUD and pose-lost mention background people. No new mean-`pose.score` banner.
- [ ] Unit tests: high confidence observed; occlusion hold; posterior jump rejected; knee Y flexion allowed; timeout releases; hips/shoulders untouched.
- [ ] Gym videos (with plates, phone on a surface): knees/ankles no longer jump behind the plates for ≤ ~700 ms; reps still count when hips are visible.
- [ ] Intentional lumbar rounding video still flags ERR_001 (hips/shoulders still live).
- [ ] No change to inference interval; stabilizer is O(1) per 4 keypoints.

## Out of scope

- Changing camera-height product guidance (rejected: gym versatility).
- Kalman / constant-velocity prediction (hold last pose only).
- Multi-person MoveNet.
- Touching `modelFrameCoords` Y / iOS mirror mapping.

## Calibration knobs (after gym replay, not now)

`LOWER_BODY_TRACK.maxHoldMs`, `jitterMax`, `observeMin`. If 700 ms is short for a slow descent with plates covering the whole bottom, raise toward 1000 ms — not 15 inference frames (~2 s).
