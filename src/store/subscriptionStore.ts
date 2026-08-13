import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY_PREFIX = "@repright/subscription_state_v1";

export type SubscriptionOwnerIdentity = {
  isLoggedIn: boolean;
  isGuest: boolean;
  userId: string | null;
  participantId: string;
};

export type SubscriptionSnapshot = {
  subscribed: boolean;
  joinedOn: string | null;
  subscriptionEndsAt: string | null;
  lastSyncedAt: string | null;
  upsellSeen: boolean;
};

type SubscriptionState = SubscriptionSnapshot & {
  hydrated: boolean;
  hydrate: (ownerKey: string) => Promise<void>;
  setSubscriptionFromProfile: (
    ownerKey: string,
    snapshot: Partial<SubscriptionSnapshot>,
  ) => Promise<void>;
  setSubscriptionActive: (ownerKey: string) => Promise<void>;
  setPremiumFromDemo: (ownerKey: string) => Promise<void>;
  markUpsellSeen: (ownerKey: string) => Promise<void>;
  clearSubscription: (ownerKey: string) => Promise<void>;
  getSubscriptionAgeMs: (now?: number) => number | null;
};

const DEFAULT_STATE: SubscriptionSnapshot = {
  subscribed: false,
  joinedOn: null,
  subscriptionEndsAt: null,
  lastSyncedAt: null,
  upsellSeen: false,
};

export function resolveSubscriptionOwnerKey(
  identity: SubscriptionOwnerIdentity,
): string {
  if (identity.isLoggedIn && identity.userId) {
    return `user:${identity.userId}`;
  }
  if (identity.isGuest) {
    return `guest:${identity.participantId}`;
  }
  return `orphan:${identity.participantId}`;
}

function isIsoDate(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length > 0;
}

function storageKey(ownerKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${ownerKey}`;
}

async function readSnapshot(ownerKey: string): Promise<SubscriptionSnapshot> {
  const raw = await AsyncStorage.getItem(storageKey(ownerKey));
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<SubscriptionSnapshot>;
    return {
      subscribed: parsed.subscribed === true,
      joinedOn: isIsoDate(parsed.joinedOn) ? parsed.joinedOn : null,
      subscriptionEndsAt: isIsoDate(parsed.subscriptionEndsAt)
        ? parsed.subscriptionEndsAt
        : null,
      lastSyncedAt: isIsoDate(parsed.lastSyncedAt) ? parsed.lastSyncedAt : null,
      upsellSeen: parsed.upsellSeen === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeSnapshot(
  ownerKey: string,
  snapshot: SubscriptionSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerKey), JSON.stringify(snapshot));
}

function computeAgeMs(joinedOn: string | null, now: number): number | null {
  if (!joinedOn) return null;
  const startedAt = new Date(joinedOn).getTime();
  if (!Number.isFinite(startedAt)) return null;
  return Math.max(0, now - startedAt);
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ...DEFAULT_STATE,
  hydrated: false,

  hydrate: async (ownerKey) => {
    const snapshot = await readSnapshot(ownerKey);
    set({ ...snapshot, hydrated: true });
  },

  setSubscriptionFromProfile: async (ownerKey, snapshot) => {
    const current = get();
    const next: SubscriptionSnapshot = {
      subscribed: snapshot.subscribed === true || current.subscribed,
      joinedOn: snapshot.joinedOn ?? null,
      subscriptionEndsAt: snapshot.subscriptionEndsAt ?? null,
      lastSyncedAt: new Date().toISOString(),
      upsellSeen: current.upsellSeen,
    };
    await writeSnapshot(ownerKey, next);
    set(next);
  },

  setSubscriptionActive: async (ownerKey) => {
    const current = get();
    const next: SubscriptionSnapshot = {
      subscribed: true,
      joinedOn: current.joinedOn ?? new Date().toISOString(),
      subscriptionEndsAt: current.subscriptionEndsAt,
      lastSyncedAt: new Date().toISOString(),
      upsellSeen: true,
    };
    await writeSnapshot(ownerKey, next);
    set(next);
  },

  setPremiumFromDemo: async (ownerKey) => {
    await get().setSubscriptionActive(ownerKey);
  },

  markUpsellSeen: async (ownerKey) => {
    const current = get();
    const next: SubscriptionSnapshot = {
      subscribed: current.subscribed,
      joinedOn: current.joinedOn,
      subscriptionEndsAt: current.subscriptionEndsAt,
      lastSyncedAt: new Date().toISOString(),
      upsellSeen: true,
    };
    await writeSnapshot(ownerKey, next);
    set(next);
  },

  clearSubscription: async (ownerKey) => {
    const next = { ...DEFAULT_STATE };
    await writeSnapshot(ownerKey, next);
    set(next);
  },

  getSubscriptionAgeMs: (now = Date.now()) => computeAgeMs(get().joinedOn, now),
}));
