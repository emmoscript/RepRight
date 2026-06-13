import type { BiomechanicalError, ErrorId } from '@/modules/analyzer';
import type { SessionLog } from '@/modules/session';
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

/** Pull stored form errors from a saved session log (new + legacy formats). */
export function extractFormErrorsFromSessionLog(log: SessionLog): BiomechanicalError[] {
  if (log.formErrors?.length) return log.formErrors;
  const legacy: BiomechanicalError[] = [];
  for (const st of log.sets ?? []) {
    for (const rep of st.reps ?? []) {
      for (const e of rep.errors ?? []) {
        legacy.push(
          normalizeRecordedFormError({
            errorId: e.errorId as BiomechanicalError['errorId'],
            severity: 'warning',
            confidence: 0.5,
            frameTimestamp: rep.startTimestamp,
            setNumber: st.setNumber,
            repNumber: rep.repNumber,
            phase: 'unknown',
          } as RecordedFormError),
        );
      }
    }
  }
  return legacy;
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

export type SessionFormFocusSummary = {
  /** Top 1–2 error types to show on list cards. */
  previewIds: ErrorId[];
  /** Total distinct error types in the session. */
  totalUnique: number;
};

/** Compact focus summary for Stats session cards. */
export function summarizeSessionFormFocus(log: SessionLog): SessionFormFocusSummary {
  const ids = focusErrorIds(extractFormErrorsFromSessionLog(log));
  return { previewIds: ids.slice(0, 2), totalUnique: ids.length };
}
