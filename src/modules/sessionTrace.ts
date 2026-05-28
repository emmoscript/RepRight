/**
 * Dev-only structured logs for live pose / rep / model debugging.
 * Lines use prefix `RR|` — filter Metro or read logs/session-live.log.
 *
 * Wireless (no USB): phone POSTs to PC on port 8787 (npm run log:session).
 * Uses the same LAN host as the Metro bundle URL (from scriptURL).
 */

import { NativeModules } from 'react-native';

type TraceCat = 'flow' | 'rep' | 'pose' | 'infer' | 'analyzer' | 'model' | 'session';

const enabled = __DEV__;
const LOG_PORT = 8787;
const throttleAt = new Map<string, number>();

let logPostUrl: string | null = null;
let logUrlResolved = false;
let forwardFailStreak = 0;

function resolveLogPostUrl(): string | null {
  if (logUrlResolved) return logPostUrl;
  logUrlResolved = true;
  try {
    const src = NativeModules.SourceCode as { scriptURL?: string } | undefined;
    const scriptURL = src?.scriptURL ?? '';
    const m = scriptURL.match(/^https?:\/\/([^/:]+)/);
    const host = m?.[1];
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      return null;
    }
    logPostUrl = `http://${host}:${LOG_PORT}/log`;
  } catch {
    logPostUrl = null;
  }
  return logPostUrl;
}

function forwardLine(line: string): void {
  if (!enabled || forwardFailStreak > 12) return;
  const url = resolveLogPostUrl();
  if (!url) return;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line }),
  })
    .then((r) => {
      if (r.ok) forwardFailStreak = 0;
      else forwardFailStreak += 1;
    })
    .catch(() => {
      forwardFailStreak += 1;
    });
}

function emit(cat: TraceCat, event: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  const payload = data ? JSON.stringify(data) : '';
  const line = `RR|${cat}|${event}|${payload}`;
  console.log(line);
  forwardLine(line);
}

function emitThrottled(
  cat: TraceCat,
  key: string,
  intervalMs: number,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (!enabled) return;
  const now = Date.now();
  const last = throttleAt.get(key) ?? 0;
  if (now - last < intervalMs) return;
  throttleAt.set(key, now);
  emit(cat, event, data);
}

export const sessionTrace = {
  reset(): void {
    throttleAt.clear();
    logUrlResolved = false;
    logPostUrl = null;
    forwardFailStreak = 0;
  },

  session(event: string, data?: Record<string, unknown>): void {
    emit('session', event, data);
  },

  model(event: string, data?: Record<string, unknown>): void {
    emit('model', event, data);
  },

  flow(from: string, to: string, data?: Record<string, unknown>): void {
    emit('flow', `${from}->${to}`, data);
  },

  rep(event: string, data?: Record<string, unknown>): void {
    emit('rep', event, data);
  },

  repPhase(from: string, to: string, data?: Record<string, unknown>): void {
    emit('rep', `phase:${from}->${to}`, data);
  },

  armReject(data: Record<string, unknown>): void {
    const reason = String(data.reason ?? 'unknown');
    emitThrottled('rep', `arm_reject:${reason}`, 900, 'arm_reject', data);
  },

  countBlocked(data: Record<string, unknown>): void {
    const reason = String(data.reason ?? 'unknown');
    emitThrottled('rep', `count_blocked:${reason}`, 1200, 'count_blocked', data);
  },

  poseSample(
    flow: string,
    data: {
      hipY: number | null;
      repPhase: string;
      reps: number;
      valid: boolean;
      lh?: number;
      lk?: number;
      la?: number;
    },
  ): void {
    emitThrottled('pose', 'sample', 900, 'tick', { flow, ...data });
  },

  inferFps(fps: number, kind: string): void {
    emitThrottled('infer', 'fps', 2500, 'throughput', { fps: Math.round(fps * 10) / 10, kind });
  },

  infer(event: string, data?: Record<string, unknown>): void {
    emit('infer', event, data);
  },

  analyzer(phase: string, errorIds: string[]): void {
    if (errorIds.length === 0) return;
    emitThrottled('analyzer', errorIds.join(','), 1200, 'detected', { phase, errors: errorIds });
  },

  rawTensor(kind: string, values: number[]): void {
    if (!enabled || values.length < 51) return;
    emit('infer', 'raw_tensor', {
      kind,
      len: values.length,
      nose: { y: values[0], x: values[1], s: values[2] },
      lHip: { y: values[33], x: values[34], s: values[35] },
      lAnkle: { y: values[45], x: values[46], s: values[47] },
    });
  },
};
