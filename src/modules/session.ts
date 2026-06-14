/**
 * session.ts
 * Session logging via AsyncStorage — scoped per account on this device.
 * Key pattern : session_${sessionId}
 * Index key   : session_index_${ownerKey}  →  string[] of sessionIds
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '@/store/authStore';
import type { RecordedFormError } from '@/types/recordedFormError';
import type { WeightUnit } from '@/utils/weightUnits';

const LEGACY_INDEX_KEY = 'session_index';
const GUEST_CLIENT_KEY = '@repright/guest_client_id';

export interface RepLog {
  repNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  score: number;
  errors: {
    errorId: string;
    frameCount: number;
    totalFrames: number;
  }[];
}

export type SessionSetSummary = {
  setNumber: number;
  repsCompleted: number;
  repsPlanned: number;
  weightAmount: number;
  weightUnit: WeightUnit;
  elapsedSec: number;
  formScore: number;
};

export interface SessionLog {
  sessionId: string;
  participantId: string;
  date: string;
  /** e.g. conventional_deadlift — one log groups all sets from a workout. */
  exercise: string;
  setSummaries: SessionSetSummary[];
  /** Rep-level form errors with set/rep/phase (saved from live session). */
  formErrors?: RecordedFormError[];
  sets: {
    setNumber: number;
    reps: RepLog[];
  }[];
  summary: {
    totalReps: number;
    plannedReps: number;
    /** Form-only score from biomechanical errors. */
    formScore: number;
    /** Reps completed ÷ planned (0–100). */
    completionPct: number;
    /** Composite performance score shown in UI (form × completion). */
    avgScore: number;
    mostFrequentError: string | null;
  };
}

function sessionIndexKey(ownerKey: string): string {
  return `session_index_${ownerKey}`;
}

/** Stable storage namespace for the active account on this device. */
export async function getSessionOwnerKey(): Promise<string> {
  const { isLoggedIn, isGuest, user } = useAuthStore.getState();
  if (isLoggedIn && user?.id) return `user:${user.id}`;
  if (isGuest) {
    const clientId = await AsyncStorage.getItem(GUEST_CLIENT_KEY);
    return `guest:${clientId ?? 'local'}`;
  }
  return `orphan:${useAuthStore.getState().participantId}`;
}

async function readIndex(indexKey: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(indexKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** One-time: move legacy global index entries that belong to this account. */
async function migrateLegacyIndex(ownerKey: string): Promise<string[]> {
  const legacyIds = await readIndex(LEGACY_INDEX_KEY);
  if (legacyIds.length === 0) return [];

  const participantId = useAuthStore.getState().participantId;
  const ownedIds: string[] = [];

  for (const id of legacyIds) {
    const session = await getSessionById(id);
    if (session && session.participantId === participantId) {
      ownedIds.push(id);
    }
  }

  if (ownedIds.length > 0) {
    await AsyncStorage.setItem(sessionIndexKey(ownerKey), JSON.stringify(ownedIds));
  }

  return ownedIds;
}

async function getOwnerSessionIds(ownerKey: string): Promise<string[]> {
  let ids = await readIndex(sessionIndexKey(ownerKey));
  if (ids.length === 0) {
    ids = await migrateLegacyIndex(ownerKey);
  }
  return ids;
}

async function getSessionById(sessionId: string): Promise<SessionLog | null> {
  const raw = await AsyncStorage.getItem(`session_${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionLog;
  } catch {
    return null;
  }
}

export async function saveSession(session: SessionLog): Promise<void> {
  const ownerKey = await getSessionOwnerKey();
  const key = `session_${session.sessionId}`;
  await AsyncStorage.setItem(key, JSON.stringify(session));

  const indexKey = sessionIndexKey(ownerKey);
  const index = await readIndex(indexKey);
  if (!index.includes(session.sessionId)) {
    index.push(session.sessionId);
    await AsyncStorage.setItem(indexKey, JSON.stringify(index));
  }
}

/** True if two logs describe the same workout (local id or started_at + exercise). */
export function sessionsMatch(a: SessionLog, b: SessionLog): boolean {
  if (a.sessionId === b.sessionId) return true;
  if (a.exercise !== b.exercise) return false;
  const aMs = new Date(a.date).getTime();
  const bMs = new Date(b.date).getTime();
  return Math.abs(aMs - bMs) < 90_000;
}

/** Import cloud sessions into local storage; skips duplicates. Returns count added. */
export async function mergeCloudSessions(imports: SessionLog[]): Promise<number> {
  if (imports.length === 0) return 0;

  const existing = await getAllSessions();
  let added = 0;

  for (const incoming of imports) {
    const duplicate = existing.some((local) => sessionsMatch(local, incoming));
    if (duplicate) continue;
    await saveSession(incoming);
    existing.push(incoming);
    added += 1;
  }

  return added;
}

export async function getSession(sessionId: string): Promise<SessionLog | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const ownerKey = await getSessionOwnerKey();
  const ids = await getOwnerSessionIds(ownerKey);
  if (!ids.includes(sessionId)) return null;

  return session;
}

export async function getAllSessions(): Promise<SessionLog[]> {
  const ownerKey = await getSessionOwnerKey();
  const ids = await getOwnerSessionIds(ownerKey);
  const results = await Promise.all(ids.map(getSessionById));
  return results
    .filter((s): s is SessionLog => s !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteSession(sessionId: string): Promise<void> {
  const ownerKey = await getSessionOwnerKey();
  const indexKey = sessionIndexKey(ownerKey);
  await AsyncStorage.removeItem(`session_${sessionId}`);
  const index = await readIndex(indexKey);
  await AsyncStorage.setItem(
    indexKey,
    JSON.stringify(index.filter((id) => id !== sessionId)),
  );
}

/** Remove all local session logs for an owner (e.g. on account deletion). */
export async function clearAllSessionsForOwner(ownerKey?: string): Promise<void> {
  const key = ownerKey ?? (await getSessionOwnerKey());
  const ids = await getOwnerSessionIds(key);
  await Promise.all(ids.map((id) => AsyncStorage.removeItem(`session_${id}`)));
  await AsyncStorage.removeItem(sessionIndexKey(key));
}
