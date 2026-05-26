/**
 * session.ts
 * Session logging via AsyncStorage.
 * Key pattern : session_${sessionId}
 * Index key   : session_index  →  string[] of sessionIds
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WeightUnit } from '@/utils/weightUnits';

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

export async function saveSession(session: SessionLog): Promise<void> {
  const key = `session_${session.sessionId}`;
  await AsyncStorage.setItem(key, JSON.stringify(session));

  const indexRaw = await AsyncStorage.getItem('session_index');
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(session.sessionId)) {
    index.push(session.sessionId);
    await AsyncStorage.setItem('session_index', JSON.stringify(index));
  }
}

export async function getSession(sessionId: string): Promise<SessionLog | null> {
  const raw = await AsyncStorage.getItem(`session_${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getAllSessions(): Promise<SessionLog[]> {
  const indexRaw = await AsyncStorage.getItem('session_index');
  if (!indexRaw) return [];
  const ids: string[] = JSON.parse(indexRaw);
  const results = await Promise.all(ids.map(getSession));
  return results.filter((s): s is SessionLog => s !== null);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(`session_${sessionId}`);
  const indexRaw = await AsyncStorage.getItem('session_index');
  if (!indexRaw) return;
  const index: string[] = JSON.parse(indexRaw);
  await AsyncStorage.setItem(
    'session_index',
    JSON.stringify(index.filter((id) => id !== sessionId)),
  );
}
