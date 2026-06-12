-- Align auth_provider CHECK with email signup (see supabase/fix_signup.sql)

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_auth_provider_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_auth_provider_check
  CHECK (auth_provider IN ('email', 'google', 'apple'));

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
