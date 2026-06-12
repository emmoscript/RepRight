-- RepRight — fix signup: auth_provider CHECK constraint blocks 'email'
-- Run in Supabase Dashboard → SQL Editor
--
-- Diagnosed error (Auth signup 500):
--   user_profiles_auth_provider_check violated by value 'email'
--
-- Email/password signup sets provider to 'email'; the original schema CHECK
-- likely only allowed other values (e.g. capitalized or OAuth-only).

-- 0) Show current constraint (should return 1 row — paste if signup still fails)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
  AND conname = 'user_profiles_auth_provider_check';

-- 1) Allow values the app + trigger use
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_auth_provider_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_auth_provider_check
  CHECK (auth_provider IN ('email', 'google', 'apple'));

-- 2) Normalize any legacy rows (optional safety)
UPDATE public.user_profiles
SET auth_provider = CASE lower(trim(auth_provider))
  WHEN 'google' THEN 'google'
  WHEN 'apple' THEN 'apple'
  WHEN 'email' THEN 'email'
  WHEN 'password' THEN 'email'
  WHEN 'email_password' THEN 'email'
  WHEN 'credentials' THEN 'email'
  ELSE 'email'
END
WHERE auth_provider IS NOT NULL
  AND lower(trim(auth_provider)) NOT IN ('email', 'google', 'apple');

-- 3) Signup trigger (idempotent — same as fix_signup.sql)
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
  IF v_provider IN ('password', 'email_password', 'credentials') THEN
    v_provider := 'email';
  ELSIF v_provider = '' OR v_provider NOT IN ('email', 'google', 'apple') THEN
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

-- 4) Confirm constraint after fix (should show email, google, apple)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
  AND conname = 'user_profiles_auth_provider_check';
