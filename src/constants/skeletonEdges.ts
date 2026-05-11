/** MoveNet / COCO-style single-person edges (index pairs) for 17-landmark layout. */
export const MOVENET_SKELETON_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [5, 6],
  [5, 7],
  [6, 8],
  [7, 9],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [12, 14],
  [13, 15],
  [14, 16],
];

/** Indices 0 nose, 1–2 eyes, 3–4 ears. */
export const MOVENET_KP_FACE = Object.freeze([0, 1, 2, 3, 4] as const);

/** Shoulders → wrists + hips (trunk + arms for deadlift feedback). */
export const MOVENET_KP_TORSO_ARMS_HIPS = Object.freeze([5, 6, 7, 8, 9, 10, 11, 12] as const);

/** Hip–ankle chains (hips overlap with torso group). */
export const MOVENET_KP_LEGS = Object.freeze([11, 12, 13, 14, 15, 16] as const);

const _faceSet = new Set<number>(MOVENET_KP_FACE as unknown as number[]);
const _armsShouldersSet = new Set<number>([5, 6, 7, 8, 9, 10]);

export function movenetKeypointPrimaryGroup(idx: number): 'face' | 'torso' | 'legs' | null {
  if (_faceSet.has(idx)) return 'face';
  if (_armsShouldersSet.has(idx) || idx === 11 || idx === 12) return 'torso';
  if (idx >= 13 && idx <= 16) return 'legs';
  return null;
}

function maxScoreForIndices(
  keypoints: { score: number }[],
  indices: readonly number[],
): number {
  let m = 0;
  for (const i of indices) {
    const k = keypoints[i];
    if (k?.score != null && k.score > m) m = k.score;
  }
  return m;
}

export type SkeletonGroupActivation = Readonly<{ face: boolean; torso: boolean; legs: boolean }>;

/** If any KP in face / torso(+arms+hips) / legs meets trigger, that whole subgraph may render for UI. */
export function skeletonGroupActivation(
  keypoints: { score: number }[],
  triggerScore: number,
): SkeletonGroupActivation {
  if (!keypoints || keypoints.length < 17) {
    return { face: false, torso: false, legs: false };
  }
  return {
    face: maxScoreForIndices(keypoints, MOVENET_KP_FACE) >= triggerScore,
    torso: maxScoreForIndices(keypoints, MOVENET_KP_TORSO_ARMS_HIPS) >= triggerScore,
    legs: maxScoreForIndices(keypoints, MOVENET_KP_LEGS) >= triggerScore,
  };
}

export function keypointRenderableByGroup(
  idx: number,
  activation: SkeletonGroupActivation,
  groupFill: boolean,
): boolean {
  if (!groupFill) return false;
  if (_faceSet.has(idx)) return activation.face;
  if (idx === 11 || idx === 12) return activation.torso || activation.legs;
  if (_armsShouldersSet.has(idx)) return activation.torso;
  if (idx >= 13 && idx <= 16) return activation.legs;
  return false;
}
