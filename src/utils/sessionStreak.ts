import type { SessionLog } from '@/modules/session';

/** Local calendar day YYYY-MM-DD for streak grouping. */
export function sessionLocalDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Consecutive calendar days with ≥1 session, ending today or yesterday.
 * Returns 0 when there is no active streak.
 */
export function computeCurrentStreakDays(sessions: SessionLog[], now = new Date()): number {
  if (sessions.length === 0) return 0;

  const trainedDays = new Set(sessions.map((s) => sessionLocalDayKey(s.date)));

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  const todayKey = dayKeyFromDate(cursor);
  if (!trainedDays.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!trainedDays.has(dayKeyFromDate(cursor))) return 0;
  }

  let streak = 0;
  for (;;) {
    const key = dayKeyFromDate(cursor);
    if (!trainedDays.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
