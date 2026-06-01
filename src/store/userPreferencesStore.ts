import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { applyAppLanguage, deviceLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n/types';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { buildSetPlans } from '@/utils/setPlan';
import { convertMass, type WeightUnit } from '@/utils/weightUnits';

const STORAGE_KEY = '@repright/user_preferences_v2';
const STORAGE_KEY_V1 = '@repright/user_preferences_v1';

type PersistedPreferences = {
  displayName: string | null;
  profilePhotoUri: string | null;
  weightUnit: WeightUnit;
  audioFeedbackEnabled: boolean;
  defaultCameraFront: boolean;
  language: AppLanguage;
  onboardingCompleted: boolean;
};

type UserPreferencesState = PersistedPreferences & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDisplayName: (name: string | null) => Promise<void>;
  setProfilePhotoUri: (uri: string | null) => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  setAudioFeedbackEnabled: (enabled: boolean) => Promise<void>;
  setDefaultCameraFront: (front: boolean) => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

function defaultLanguage(): AppLanguage {
  return deviceLanguage();
}

const DEFAULTS: PersistedPreferences = {
  displayName: null,
  profilePhotoUri: null,
  weightUnit: 'lb',
  audioFeedbackEnabled: true,
  defaultCameraFront: true,
  language: defaultLanguage(),
  onboardingCompleted: false,
};

function parseLanguage(raw: unknown, fallback: AppLanguage): AppLanguage {
  return raw === 'es' ? 'es' : raw === 'en' ? 'en' : fallback;
}

function normalizePrefs(
  parsed: Partial<PersistedPreferences>,
  fallback: PersistedPreferences,
): PersistedPreferences {
  return {
    displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
    profilePhotoUri: typeof parsed.profilePhotoUri === 'string' ? parsed.profilePhotoUri : null,
    weightUnit: parsed.weightUnit === 'kg' ? 'kg' : 'lb',
    audioFeedbackEnabled: parsed.audioFeedbackEnabled !== false,
    defaultCameraFront: parsed.defaultCameraFront !== false,
    language: parseLanguage(parsed.language, fallback.language),
    onboardingCompleted: parsed.onboardingCompleted === true,
  };
}

async function readPreferences(): Promise<PersistedPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizePrefs(JSON.parse(raw) as Partial<PersistedPreferences>, DEFAULTS);
    }

    const v1Raw = await AsyncStorage.getItem(STORAGE_KEY_V1);
    if (v1Raw) {
      const migrated = normalizePrefs(JSON.parse(v1Raw) as Partial<PersistedPreferences>, {
        ...DEFAULTS,
        language: defaultLanguage(),
      });
      await writePreferences(migrated);
      return migrated;
    }

    return { ...DEFAULTS, language: defaultLanguage() };
  } catch {
    return { ...DEFAULTS, language: defaultLanguage() };
  }
}

async function writePreferences(prefs: PersistedPreferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function applyWeightUnitToSessionConfig(nextUnit: WeightUnit): void {
  const config = useSessionConfigStore.getState();
  const convertedAmount = convertMass(config.weightAmount, config.weightUnit, nextUnit);
  const convertedPlans = config.setPlans.map((row) => ({
    ...row,
    weightAmount: convertMass(row.weightAmount, config.weightUnit, nextUnit),
  }));
  useSessionConfigStore.getState().patch({
    weightUnit: nextUnit,
    weightAmount: convertedAmount,
    setPlans: config.customSetPlan
      ? convertedPlans
      : buildSetPlans(config.setCount, config.repsPerSet, convertedAmount),
  });
}

export const useUserPreferencesStore = create<UserPreferencesState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    const prefs = await readPreferences();
    applyAppLanguage(prefs.language);
    set({ ...prefs, hydrated: true });
    applyWeightUnitToSessionConfig(prefs.weightUnit);
  },

  setDisplayName: async (name) => {
    const displayName = name?.trim() ? name.trim() : null;
    const next = { ...pickPersisted(get()), displayName };
    await writePreferences(next);
    set({ displayName });
  },

  setProfilePhotoUri: async (uri) => {
    const profilePhotoUri = uri?.trim() ? uri.trim() : null;
    const next = { ...pickPersisted(get()), profilePhotoUri };
    await writePreferences(next);
    set({ profilePhotoUri });
  },

  setWeightUnit: async (unit) => {
    const next = { ...pickPersisted(get()), weightUnit: unit };
    await writePreferences(next);
    set({ weightUnit: unit });
    applyWeightUnitToSessionConfig(unit);
  },

  setAudioFeedbackEnabled: async (enabled) => {
    const next = { ...pickPersisted(get()), audioFeedbackEnabled: enabled };
    await writePreferences(next);
    set({ audioFeedbackEnabled: enabled });
  },

  setDefaultCameraFront: async (front) => {
    const next = { ...pickPersisted(get()), defaultCameraFront: front };
    await writePreferences(next);
    set({ defaultCameraFront: front });
  },

  setLanguage: async (lang) => {
    const next = { ...pickPersisted(get()), language: lang };
    await writePreferences(next);
    applyAppLanguage(lang);
    set({ language: lang });
  },

  completeOnboarding: async () => {
    const next = { ...pickPersisted(get()), onboardingCompleted: true };
    await writePreferences(next);
    set({ onboardingCompleted: true });
  },
}));

function pickPersisted(state: UserPreferencesState): PersistedPreferences {
  return {
    displayName: state.displayName,
    profilePhotoUri: state.profilePhotoUri,
    weightUnit: state.weightUnit,
    audioFeedbackEnabled: state.audioFeedbackEnabled,
    defaultCameraFront: state.defaultCameraFront,
    language: state.language,
    onboardingCompleted: state.onboardingCompleted,
  };
}
