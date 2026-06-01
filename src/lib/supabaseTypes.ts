/**
 * Supabase Database Type Definitions
 * Generated for weight feature integration
 */

// ─────────────────────────────────────────────────────────────
// Database Table Row Types
// ─────────────────────────────────────────────────────────────

export type WorkoutSession = {
  id: string;
  user_id: string;
  exercise: string;
  set_count: number;
  started_at: string; // ISO timestamp
  completed_at: string; // ISO timestamp
  weight: number | null; // Weight in kg, NULL if not specified
  created_at: string;
};

export type BiomechanicalError = {
  id: string;
  session_id: string;
  error_type: string; // e.g., "ERR_001", "ERR_002"
  timestamp_ms: number;
  confidence: number; // 0-1
  severity: "low" | "medium" | "high";
  metadata: Record<string, any> | null;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────
// RPC Function Parameter Types
// ─────────────────────────────────────────────────────────────

export type BiomechanicalErrorInput = {
  error_type: string;
  timestamp_ms: number;
  confidence: number;
  severity: "low" | "medium" | "high";
  metadata?: Record<string, any>;
};

export type SaveSessionWithErrorsParams = {
  p_exercise: string;
  p_set_count: number;
  p_started_at: string;
  p_weight: number | null;
  p_errors: BiomechanicalErrorInput[];
};

// ─────────────────────────────────────────────────────────────
// Return Types
// ─────────────────────────────────────────────────────────────

export type SaveSessionResponse = string; // Returns session UUID

// ─────────────────────────────────────────────────────────────
// Query Helper Types
// ─────────────────────────────────────────────────────────────

export type WorkoutSessionWithErrors = WorkoutSession & {
  biomechanical_errors: BiomechanicalError[];
};
