import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_KEY = 'repright:crash_diag_v1';
const LOG_FILE = `${FileSystem.documentDirectory ?? ''}repright-crash-diag.log`;
const MAX_BREADCRUMBS = 40;

export type CrashRecord = {
  message: string;
  stack?: string;
  isFatal: boolean;
  at: string;
};

type DiagState = {
  breadcrumbs: string[];
  lastCrash: CrashRecord | null;
  sessionId: string;
};

let memory: DiagState = {
  breadcrumbs: [],
  lastCrash: null,
  sessionId: newSessionId(),
};

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatLine(parts: string[]): string {
  return parts.join(' | ');
}

async function persist(state: DiagState): Promise<void> {
  const payload = JSON.stringify(state);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore
  }
  try {
    if (FileSystem.documentDirectory) {
      await FileSystem.writeAsStringAsync(LOG_FILE, payload);
    }
  } catch {
    // ignore
  }
}

/** Call once on cold start — restores last crash from previous run. */
export async function hydrateCrashDiag(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DiagState;
    if (parsed.lastCrash) {
      memory = {
        ...memory,
        lastCrash: parsed.lastCrash,
        breadcrumbs: parsed.breadcrumbs ?? [],
      };
    }
  } catch {
    // ignore corrupt payload
  }
}

export function diagBreadcrumb(event: string, detail?: Record<string, unknown>): void {
  const line = formatLine([
    new Date().toISOString(),
    memory.sessionId,
    event,
    detail ? JSON.stringify(detail) : '',
  ]).trim();
  memory.breadcrumbs = [...memory.breadcrumbs.slice(-(MAX_BREADCRUMBS - 1)), line];
  void persist(memory);
}

export function diagRecordError(error: unknown, isFatal: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  memory.lastCrash = { message, stack, isFatal, at: new Date().toISOString() };
  diagBreadcrumb(isFatal ? 'fatal_error' : 'js_error', { message });
}

export function getDiagReport(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.nativeBuildVersion ??
    '?';
  const lines = [
    'RepRight diagnostic report',
    `platform: ${Platform.OS} ${String(Platform.Version)}`,
    `app: ${version} (${build})`,
    `session: ${memory.sessionId}`,
    '',
    '--- last crash ---',
    memory.lastCrash
      ? formatLine([
          memory.lastCrash.at,
          memory.lastCrash.isFatal ? 'FATAL' : 'error',
          memory.lastCrash.message,
        ])
      : '(none recorded)',
    memory.lastCrash?.stack ?? '',
    '',
    '--- breadcrumbs (newest last) ---',
    ...memory.breadcrumbs,
  ];
  return lines.join('\n');
}

export function installCrashDiagnostics(): void {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    diagRecordError(error, isFatal ?? true);
    void persist(memory);
    prev(error, isFatal);
  });
}
