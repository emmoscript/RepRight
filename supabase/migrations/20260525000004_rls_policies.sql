-- Row Level Security: users can read/update own data; writes go through RPC

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biomechanical_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- user_profiles
DROP POLICY IF EXISTS "users read own profile" ON public.user_profiles;
CREATE POLICY "users read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users update own profile" ON public.user_profiles;
CREATE POLICY "users update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "users insert own profile" ON public.user_profiles;
CREATE POLICY "users insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- workout_sessions (read only from client; insert via RPC)
DROP POLICY IF EXISTS "users read own sessions" ON public.workout_sessions;
CREATE POLICY "users read own sessions" ON public.workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- biomechanical_errors
DROP POLICY IF EXISTS "users read own errors" ON public.biomechanical_errors;
CREATE POLICY "users read own errors" ON public.biomechanical_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = biomechanical_errors.session_id
        AND ws.user_id = auth.uid()
    )
  );

-- user_stats
DROP POLICY IF EXISTS "users read own stats" ON public.user_stats;
CREATE POLICY "users read own stats" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);
