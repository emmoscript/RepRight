/**
 * Supabase database types — keep in sync with supabase/migrations/
 */

import type { AppLanguage } from "@/i18n/types";
import type { WeightUnit } from "@/utils/weightUnits";

// ── Table row types ───────────────────────────────────────────────────────────

export type UserProfileRow = {
  id: string;
  auth_provider: string;
  display_name: string | null;
  avatar_url: string | null;
  weight_unit: WeightUnit | null;
  language: AppLanguage | null;
  audio_feedback_enabled: boolean | null;
  default_camera_front: boolean | null;
  subscribed: boolean | null;
  joined_on: string | null;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  exercise: string;
  set_count: number;
  started_at: string;
  completed_at: string | null;
  weight: number | null;
  weight_unit: WeightUnit | null;
  total_reps: number | null;
  form_score: number | null;
  completion_pct: number | null;
  avg_score: number | null;
  created_at: string;
};

export type BiomechanicalError = {
  id: string;
  session_id: string;
  error_type: string;
  timestamp_ms: number;
  confidence: number;
  severity: "low" | "medium" | "high";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type UserStatsRow = {
  user_id: string;
  total_sessions: number;
  total_sets: number;
  total_errors: number;
  last_session_at: string | null;
  most_common_error: string | null;
  updated_at: string;
};

// ── RPC types ─────────────────────────────────────────────────────────────────

export type BiomechanicalErrorInput = {
  error_type: string;
  timestamp_ms: number;
  confidence: number;
  severity: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
};

export type SaveSessionWithErrorsParams = {
  p_exercise: string;
  p_set_count: number;
  p_started_at: string;
  p_weight: number | null;
  p_weight_unit: WeightUnit;
  p_total_reps: number | null;
  p_form_score: number | null;
  p_completion_pct: number | null;
  p_avg_score: number | null;
  p_errors: BiomechanicalErrorInput[];
};

export type SaveSessionResponse = string;

export type SessionSyncExtras = {
  weightUnit: WeightUnit;
  totalReps: number;
  formScore: number;
  completionPct: number;
  avgScore: number;
  startedAtMs?: number;
};

export type WorkoutSessionWithErrors = WorkoutSession & {
  biomechanical_errors: BiomechanicalError[];
};
