-- RPC: save workout session + biomechanical errors + update user_stats

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
    user_id,
    exercise,
    set_count,
    started_at,
    completed_at,
    weight,
    weight_unit,
    total_reps,
    form_score,
    completion_pct,
    avg_score
  )
  VALUES (
    v_user_id,
    p_exercise,
    p_set_count,
    p_started_at,
    now(),
    p_weight,
    p_weight_unit,
    p_total_reps,
    p_form_score,
    p_completion_pct,
    p_avg_score
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.biomechanical_errors (
    session_id,
    error_type,
    timestamp_ms,
    confidence,
    severity,
    metadata
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
  FROM public.biomechanical_errors
  WHERE session_id = v_session_id;

  SELECT error_type INTO v_top_error
  FROM public.biomechanical_errors
  WHERE session_id = v_session_id
  GROUP BY error_type
  ORDER BY count(*) DESC
  LIMIT 1;

  INSERT INTO public.user_stats (
    user_id,
    total_sessions,
    total_sets,
    total_errors,
    last_session_at,
    most_common_error,
    updated_at
  )
  VALUES (
    v_user_id,
    1,
    p_set_count,
    v_error_count,
    now(),
    v_top_error,
    now()
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
