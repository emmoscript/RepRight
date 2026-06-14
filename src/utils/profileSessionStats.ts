import type { SessionLog } from '@/modules/session';
import { computeCurrentStreakDays } from '@/utils/sessionStreak';

export type ProfileSessionStats = {
  bestFormPct: number | null;
  sessionCount: number;
  streakDays: number;
};

function sessionFormScore(log: SessionLog): number {
  return log.summary.formScore ?? log.summary.avgScore ?? 0;
}

export function computeProfileSessionStats(sessions: SessionLog[]): ProfileSessionStats {
  if (sessions.length === 0) {
    return { bestFormPct: null, sessionCount: 0, streakDays: 0 };
  }

  const bestFormPct = sessions.reduce(
    (max, s) => Math.max(max, sessionFormScore(s)),
    0,
  );

  return {
    bestFormPct,
    sessionCount: sessions.length,
    streakDays: computeCurrentStreakDays(sessions),
  };
}
