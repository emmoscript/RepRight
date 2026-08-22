import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

import { saveSession, type SessionLog } from '@/modules/session';
import { navigationRef } from '@/navigation/navigationRef';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { useSubscriptionStore, resolveSubscriptionOwnerKey } from '@/store/subscriptionStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import type { SessionReviewSnapshot } from '@/utils/sessionScore';

const PREFS_KEY = '@repright/user_preferences_v2';

export const DOC_SCREENSHOT_IDS = [
  '01-onboarding',
  '02-home',
  '03-configure-session',
  '04-live-session',
  '05-session-complete',
  '06-paywall',
  '07-stats-free',
  '08-profile-subscription',
  '09-welcome',
] as const;

export type DocScreenshotId = (typeof DOC_SCREENSHOT_IDS)[number];

let pendingDocScreenshotId: DocScreenshotId | null = null;

export function isDocScreenshotUrl(url: string): boolean {
  return /doc-screenshot\//i.test(url);
}

export function parseDocScreenshotId(url: string): DocScreenshotId | null {
  const m = url.match(/doc-screenshot\/([\w-]+)/i);
  const id = m?.[1] as DocScreenshotId | undefined;
  return id && DOC_SCREENSHOT_IDS.includes(id) ? id : null;
}

async function resetOnboardingFlag(completed: boolean): Promise<void> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  parsed.onboardingCompleted = completed;
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(parsed));
  useUserPreferencesStore.setState({ onboardingCompleted: completed });
}

async function ensureGuestDemoProfile(): Promise<void> {
  await useAuthStore.getState().enterAsGuest();
  await useUserPreferencesStore.getState().setDisplayName('Atleta UNIBE');
  await useUserPreferencesStore.getState().setLanguage('es');
  await resetOnboardingFlag(true);
}

async function resetSubscriptionForDoc(): Promise<void> {
  const { isLoggedIn, isGuest, participantId, user } = useAuthStore.getState();
  const ownerKey = resolveSubscriptionOwnerKey({
    isLoggedIn,
    isGuest,
    userId: user?.id ?? null,
    participantId,
  });
  await useSubscriptionStore.getState().clearSubscription(ownerKey);
}

function seedSessionConfig(): void {
  useSessionConfigStore.getState().patch({
    exercise: 'conventional_deadlift',
    setCount: 3,
    repsPerSet: 5,
    weightAmount: 135,
    weightUnit: 'lb',
    customSetPlan: false,
  });
}

function seedSessionReview(): void {
  const now = Date.now();
  const review: SessionReviewSnapshot = {
    capturedAt: now,
    startedAt: now - 120_000,
    currentSetNumber: 3,
    lastSetReps: 5,
    lastSetElapsedSec: 84,
    errors: [
      {
        errorId: 'ERR_003',
        severity: 'warning',
        confidence: 0.82,
        frameTimestamp: now - 30_000,
      },
      {
        errorId: 'ERR_001',
        severity: 'critical',
        confidence: 0.76,
        frameTimestamp: now - 45_000,
      },
    ],
    workoutSetSnapshots: [
      {
        setNumber: 1,
        weightAmount: 135,
        weightUnit: 'lb',
        reps: 5,
        elapsedSec: 72,
        scoreRounded: 85,
      },
      {
        setNumber: 2,
        weightAmount: 135,
        weightUnit: 'lb',
        reps: 5,
        elapsedSec: 78,
        scoreRounded: 88,
      },
    ],
    planSlice: {
      customSetPlan: false,
      setCount: 3,
      repsPerSet: 5,
      weightAmount: 135,
      setPlans: [],
    },
    weightUnit: 'lb',
    exercise: 'conventional_deadlift',
    plannedSetCount: 3,
  };
  useSessionResultStore.getState().setSessionReview(review);
  useSessionResultStore.setState({
    startedAt: review.startedAt,
    currentSetNumber: review.currentSetNumber,
    lastSetReps: review.lastSetReps,
    lastSetElapsedSec: review.lastSetElapsedSec,
    workoutSetSnapshots: review.workoutSetSnapshots,
  });
}

async function seedStatsHistory(): Promise<void> {
  const base = Date.now();
  const logs: SessionLog[] = [0, 2, 4, 6, 8, 10, 12, 14].map((daysAgo, i) => ({
    sessionId: `doc-seed-${i}`,
    date: new Date(base - daysAgo * 86_400_000).toISOString(),
    exercise: 'conventional_deadlift',
    participantId: useAuthStore.getState().participantId,
    setSummaries: [
      {
        setNumber: 1,
        repsCompleted: 5,
        repsPlanned: 5,
        weightAmount: 135,
        weightUnit: 'lb',
        elapsedSec: 72,
        formScore: 80 + i,
      },
    ],
    sets: [
      {
        setNumber: 1,
        reps: [
          {
            repNumber: 1,
            startTimestamp: base - daysAgo * 86_400_000,
            endTimestamp: base - daysAgo * 86_400_000 + 60_000,
            score: 80 + i,
            errors: [],
          },
        ],
      },
    ],
    summary: {
      totalReps: 15 - (i % 3) * 2,
      plannedReps: 15,
      formScore: 80 + i,
      completionPct: 100,
      avgScore: 80 + i,
      mostFrequentError: i % 2 === 0 ? 'ERR_003' : 'ERR_001',
    },
  }));
  for (const log of logs) {
    await saveSession(log);
  }
}

function resetNav(route: {
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
}): void {
  navigationRef.reset({
    index: 0,
    routes: [route as never],
  });
}

function signalScreenshotReady(id: DocScreenshotId): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (__DEV__) {
          console.log(`[DOC_SCREENSHOT_READY] ${id}`);
        }
        resolve();
      }, 900);
    });
  });
}

export function queueDocScreenshot(id: DocScreenshotId): void {
  pendingDocScreenshotId = id;
}

export function flushPendingDocScreenshot(): void {
  const id = pendingDocScreenshotId;
  if (!id) return;
  pendingDocScreenshotId = null;
  void openDocScreenshot(id);
}

/** Deep link entry — queues until NavigationContainer is ready. */
export function requestDocScreenshot(id: DocScreenshotId): void {
  if (navigationRef.isReady()) {
    void openDocScreenshot(id);
    return;
  }
  queueDocScreenshot(id);
}

/** Navigate + seed stores for academic doc screenshots (__DEV__ / adb deep links). */
export async function openDocScreenshot(id: DocScreenshotId): Promise<void> {
  if (!navigationRef.isReady()) {
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!navigationRef.isReady()) {
    queueDocScreenshot(id);
    return;
  }

  await resetSubscriptionForDoc();

  switch (id) {
    case '01-onboarding':
      await resetOnboardingFlag(false);
      resetNav({ name: 'Demo', params: { docStep: 0 } });
      break;

    case '09-welcome':
      await resetOnboardingFlag(true);
      await useAuthStore.getState().signOut();
      resetNav({ name: 'Welcome' });
      break;

    case '02-home':
      await ensureGuestDemoProfile();
      seedSessionConfig();
      resetNav({ name: 'MainTabs', params: { screen: 'HomeMain' } });
      break;

    case '03-configure-session':
      await ensureGuestDemoProfile();
      seedSessionConfig();
      resetNav({
        name: 'MainTabs',
        params: { screen: 'Workout', params: { screen: 'DeadliftConfigure' } },
      });
      break;

    case '04-live-session':
      await ensureGuestDemoProfile();
      seedSessionConfig();
      resetNav({ name: 'LiveSession', params: { docForceFlow: 'active' } });
      break;

    case '05-session-complete':
      await ensureGuestDemoProfile();
      seedSessionConfig();
      seedSessionReview();
      resetNav({ name: 'SessionComplete' });
      break;

    case '06-paywall':
      await ensureGuestDemoProfile();
      resetNav({ name: 'SubscriptionOffer', params: { source: 'first_session' } });
      break;

    case '07-stats-free':
      await ensureGuestDemoProfile();
      await seedStatsHistory();
      await resetSubscriptionForDoc();
      resetNav({ name: 'MainTabs', params: { screen: 'StatsMain' } });
      break;

    case '08-profile-subscription':
      await ensureGuestDemoProfile();
      resetNav({ name: 'MainTabs', params: { screen: 'ProfileMain' } });
      break;

    default:
      break;
  }

  await signalScreenshotReady(id);
}
