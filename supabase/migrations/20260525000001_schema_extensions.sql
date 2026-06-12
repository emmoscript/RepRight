-- RepRight: extend schema for full session + profile sync
-- Run in Supabase Dashboard → SQL Editor (or via Supabase CLI)

-- ── workout_sessions: scores + weight unit ──────────────────────────────────
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS weight_unit text CHECK (weight_unit IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS total_reps int4,
  ADD COLUMN IF NOT EXISTS form_score int4,
  ADD COLUMN IF NOT EXISTS completion_pct int4,
  ADD COLUMN IF NOT EXISTS avg_score int4;

-- ── user_profiles: synced app preferences ───────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'lb' CHECK (weight_unit IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en' CHECK (language IN ('en', 'es')),
  ADD COLUMN IF NOT EXISTS audio_feedback_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_camera_front boolean DEFAULT true;
