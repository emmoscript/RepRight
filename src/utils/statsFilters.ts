import i18n from '@/i18n';
import type { SessionLog } from '@/modules/session';

export type StatsFilterKind = 'week' | 'last' | 'month';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return startOfDay(mon);
}

export function filterSessionsByPeriod(
  sessions: SessionLog[],
  filter: StatsFilterKind,
  anchor: Date = new Date(),
): SessionLog[] {
  const now = anchor.getTime();
  if (filter === 'week') {
    const from = startOfWeek(anchor).getTime();
    return sessions.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= from && t <= now;
    });
  }
  if (filter === 'last') {
    const thisWeekStart = startOfWeek(anchor).getTime();
    const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= lastWeekStart && t < thisWeekStart;
    });
  }
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  return sessions.filter((s) => new Date(s.date).getTime() >= monthStart);
}

export function groupSessionsByExercise(
  sessions: SessionLog[],
): Array<{ exerciseId: string; sessions: SessionLog[] }> {
  const map = new Map<string, SessionLog[]>();
  for (const s of sessions) {
    const id = s.exercise || 'conventional_deadlift';
    const list = map.get(id) ?? [];
    list.push(s);
    map.set(id, list);
  }
  return [...map.entries()]
    .map(([exerciseId, rows]) => ({
      exerciseId,
      sessions: rows.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}

export function exerciseDisplayName(exerciseId: string): string {
  const key = `workout.exercise.${exerciseId}.title`;
  if (i18n.exists(key)) return i18n.t(key);
  return exerciseId.replace(/_/g, ' ');
}
