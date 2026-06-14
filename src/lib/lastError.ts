import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'repright:last_fatal_error';

export type LastErrorRecord = {
  message: string;
  stack?: string;
  at: string;
};

export async function saveLastError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const record: LastErrorRecord = { message, stack, at: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // ignore persistence failures
  }
}

export async function readLastError(): Promise<LastErrorRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastErrorRecord;
  } catch {
    return null;
  }
}

export function installGlobalErrorHandler(): void {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Avoid AsyncStorage during fatal teardown — can race with native crash handling.
    if (!isFatal) {
      void saveLastError(error);
    }
    prev(error, isFatal);
  });
}
