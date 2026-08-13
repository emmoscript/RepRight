import type { AppLanguage } from "@/i18n/types";
import { supabase } from "@/lib/supabaseClient";
import type { UserProfileRow } from "@/lib/supabaseTypes";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import type { WeightUnit } from "@/utils/weightUnits";

function parseLanguage(raw: unknown): AppLanguage | null {
  return raw === "en" || raw === "es" ? raw : null;
}

function parseWeightUnit(raw: unknown): WeightUnit | null {
  return raw === "kg" || raw === "lb" ? raw : null;
}

export function displayNameFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;
  for (const key of ["full_name", "name", "given_name"] as const) {
    const raw = metadata[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/** Pull cloud profile into local preferences (logged-in users). */
export async function pullProfileFromSupabase(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn("[profileSync] pull failed:", error.message);
    return;
  }

  if (!data) {
    await pushProfileToSupabase(userId);
    await useSubscriptionStore.getState().setSubscriptionFromProfile(userId, {
      subscribed: false,
      joinedOn: null,
      subscriptionEndsAt: null,
    });
    return;
  }

  const row = data as UserProfileRow;
  const prefs = useUserPreferencesStore.getState();

  if (row.display_name?.trim()) {
    await prefs.setDisplayName(row.display_name.trim());
  }

  const unit = parseWeightUnit(row.weight_unit);
  if (unit) await prefs.setWeightUnit(unit);

  const lang = parseLanguage(row.language);
  if (lang) await prefs.setLanguage(lang);

  if (typeof row.audio_feedback_enabled === "boolean") {
    await prefs.setAudioFeedbackEnabled(row.audio_feedback_enabled);
  }

  if (typeof row.default_camera_front === "boolean") {
    await prefs.setDefaultCameraFront(row.default_camera_front);
  }

  if (row.avatar_url?.trim()) {
    await prefs.setProfilePhotoUri(row.avatar_url.trim());
  }

  await useSubscriptionStore.getState().setSubscriptionFromProfile(userId, {
    subscribed: row.subscribed === true,
    joinedOn: typeof row.joined_on === "string" ? row.joined_on : null,
    subscriptionEndsAt:
      typeof row.subscription_ends_at === "string"
        ? row.subscription_ends_at
        : null,
  });
}

/** Push local preferences to user_profiles (best-effort). */
export async function pushProfileToSupabase(userId: string): Promise<void> {
  const prefs = useUserPreferencesStore.getState();

  let authProvider: UserProfileRow["auth_provider"] = "email";
  const { data: authData } = await supabase.auth.getUser();
  const provider = authData.user?.app_metadata?.provider;
  if (provider === "google" || provider === "apple") {
    authProvider = provider;
  }

  const metaName = displayNameFromMetadata(authData.user?.user_metadata);
  const displayName = prefs.displayName?.trim() || metaName || null;

  const payload = {
    id: userId,
    display_name: displayName,
    weight_unit: prefs.weightUnit,
    language: prefs.language,
    audio_feedback_enabled: prefs.audioFeedbackEnabled,
    default_camera_front: prefs.defaultCameraFront,
    auth_provider: authProvider,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" });

  if (error && __DEV__) {
    console.warn("[profileSync] push failed:", error.message);
  }
}
