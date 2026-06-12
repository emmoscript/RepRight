-- RepRight — run ONCE in Supabase Dashboard → SQL Editor (paste entire file → Run)
-- Order matches supabase/migrations/*.sql

-- 1) Schema extensions
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS weight_unit text CHECK (weight_unit IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS total_reps int4,
  ADD COLUMN IF NOT EXISTS form_score int4,
  ADD COLUMN IF NOT EXISTS completion_pct int4,
  ADD COLUMN IF NOT EXISTS avg_score int4;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'lb' CHECK (weight_unit IN ('kg', 'lb')),
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en' CHECK (language IN ('en', 'es')),
  ADD COLUMN IF NOT EXISTS audio_feedback_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_camera_front boolean DEFAULT true;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_auth_provider_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_auth_provider_check
  CHECK (auth_provider IN ('email', 'google', 'apple'));

-- 2) Profile trigger + backfill
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_auth_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text;
  v_name text;
BEGIN
  v_provider := lower(trim(COALESCE(NEW.raw_app_meta_data->>'provider', '')));
  IF v_provider = '' OR v_provider NOT IN ('email', 'google', 'apple') THEN
    v_provider := 'email';
  END IF;

  v_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO public.user_profiles (id, auth_provider, display_name)
  VALUES (NEW.id, v_provider, v_name)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    auth_provider = COALESCE(user_profiles.auth_provider, EXCLUDED.auth_provider);

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_user failed for %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON TABLE public.user_profiles TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.user_profiles (id, auth_provider, display_name)
SELECT
  u.id,
  CASE
    WHEN lower(trim(COALESCE(u.raw_app_meta_data->>'provider', ''))) IN ('email', 'google', 'apple')
      THEN lower(trim(u.raw_app_meta_data->>'provider'))
    ELSE 'email'
  END,
  NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', '')), '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id = u.id
);

-- 3) RPC (replaces previous save_session_with_errors)
CREATE OR REPLACE FUNCTION public.save_session_with_errors(
  p_exercise text,
  p_set_count int,
  p_started_at timestamptz,
  p_weight float8 DEFAULT NULL,
  p_weight_unit text DEFAULT 'lb',
  p_total_reps int DEFAULT NULL,
  p_form_score int DEFAULT NULL,
  p_completion_pct int DEFAULT NULL,
  p_avg_score int DEFAULT NULL,
  p_errors jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_error_count int;
  v_top_error text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_weight IS NOT NULL AND p_weight <= 0 THEN
    RAISE EXCEPTION 'weight must be > 0';
  END IF;

  IF p_weight_unit IS NOT NULL AND p_weight_unit NOT IN ('kg', 'lb') THEN
    RAISE EXCEPTION 'weight_unit must be kg or lb';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, exercise, set_count, started_at, completed_at,
    weight, weight_unit, total_reps, form_score, completion_pct, avg_score
  )
  VALUES (
    v_user_id, p_exercise, p_set_count, p_started_at, now(),
    p_weight, p_weight_unit, p_total_reps, p_form_score, p_completion_pct, p_avg_score
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.biomechanical_errors (
    session_id, error_type, timestamp_ms, confidence, severity, metadata
  )
  SELECT
    v_session_id,
    e->>'error_type',
    (e->>'timestamp_ms')::bigint,
    (e->>'confidence')::float8,
    e->>'severity',
    CASE
      WHEN e ? 'metadata' AND e->'metadata' IS NOT NULL AND e->'metadata' <> 'null'::jsonb
      THEN e->'metadata'
      ELSE NULL
    END
  FROM jsonb_array_elements(COALESCE(p_errors, '[]'::jsonb)) AS e
  WHERE e->>'error_type' IS NOT NULL;

  SELECT count(*)::int INTO v_error_count
  FROM public.biomechanical_errors WHERE session_id = v_session_id;

  SELECT error_type INTO v_top_error
  FROM public.biomechanical_errors
  WHERE session_id = v_session_id
  GROUP BY error_type
  ORDER BY count(*) DESC
  LIMIT 1;

  INSERT INTO public.user_stats (
    user_id, total_sessions, total_sets, total_errors,
    last_session_at, most_common_error, updated_at
  )
  VALUES (
    v_user_id, 1, p_set_count, v_error_count, now(), v_top_error, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_sessions = user_stats.total_sessions + 1,
    total_sets = user_stats.total_sets + EXCLUDED.total_sets,
    total_errors = user_stats.total_errors + EXCLUDED.total_errors,
    last_session_at = EXCLUDED.last_session_at,
    most_common_error = COALESCE(v_top_error, user_stats.most_common_error),
    updated_at = now();

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_session_with_errors(
  text, int, timestamptz, float8, text, int, int, int, int, jsonb
) TO authenticated;

-- 4) RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biomechanical_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own profile" ON public.user_profiles;
CREATE POLICY "users read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users update own profile" ON public.user_profiles;
CREATE POLICY "users update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "users insert own profile" ON public.user_profiles;
CREATE POLICY "users insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users read own sessions" ON public.workout_sessions;
CREATE POLICY "users read own sessions" ON public.workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users read own errors" ON public.biomechanical_errors;
CREATE POLICY "users read own errors" ON public.biomechanical_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = biomechanical_errors.session_id AND ws.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users read own stats" ON public.user_stats;
CREATE POLICY "users read own stats" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);
