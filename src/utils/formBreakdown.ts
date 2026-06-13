import type { BiomechanicalError, ErrorId } from '@/modules/analyzer';
import type { RecordedFormError } from '@/types/recordedFormError';

export function normalizeRecordedFormError(error: BiomechanicalError): RecordedFormError {
  if ('setNumber' in error && 'repNumber' in error && 'phase' in error) {
    return error as RecordedFormError;
  }
  return {
    ...error,
    setNumber: 1,
    repNumber: 1,
    phase: 'unknown',
  };
}

export function formErrorRecordKey(
  errorId: ErrorId,
  setNumber: number,
  repNumber: number,
): string {
  return `${errorId}:s${setNumber}:r${repNumber}`;
}

export function hasFormErrorRecord(
  recorded: Set<string>,
  errorId: ErrorId,
  setNumber: number,
  repNumber: number,
): boolean {
  return recorded.has(formErrorRecordKey(errorId, setNumber, repNumber));
}

export function hasFormErrorRecorded(recorded: Set<string>, errorId: ErrorId): boolean {
  const prefix = `${errorId}:`;
  for (const key of recorded) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export type FormBreakdownGroup = {
  setNumber: number;
  repNumber: number;
  errors: RecordedFormError[];
};

/** Sort groups by set, then rep (setup/pre-rep = 0 first). */
export function groupFormErrorsByRep(errors: BiomechanicalError[]): FormBreakdownGroup[] {
  const map = new Map<string, FormBreakdownGroup>();
  for (const raw of errors) {
    const err = normalizeRecordedFormError(raw);
    const key = `${err.setNumber}:${err.repNumber}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.errors.some((e) => e.errorId === err.errorId)) {
        existing.errors.push(err);
      }
    } else {
      map.set(key, { setNumber: err.setNumber, repNumber: err.repNumber, errors: [err] });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.setNumber !== b.setNumber) return a.setNumber - b.setNumber;
    return a.repNumber - b.repNumber;
  });
}

/** Most frequent error types in the session (for focus summary). */
export function focusErrorIds(errors: BiomechanicalError[]): ErrorId[] {
  const counts = new Map<ErrorId, number>();
  for (const raw of errors) {
    const err = normalizeRecordedFormError(raw);
    counts.set(err.errorId, (counts.get(err.errorId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
