-- Self-service account deletion (Apple App Store requirement)

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.biomechanical_errors
  WHERE session_id IN (
    SELECT id FROM public.workout_sessions WHERE user_id = v_user_id
  );

  DELETE FROM public.workout_sessions WHERE user_id = v_user_id;
  DELETE FROM public.user_stats WHERE user_id = v_user_id;
  DELETE FROM public.user_profiles WHERE id = v_user_id;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
