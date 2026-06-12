-- Fix signup trigger (see supabase/fix_signup.sql — same content for migration history)

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
