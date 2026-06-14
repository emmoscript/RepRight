-- In-app biomechanical knowledge questionnaire (UNIBE research)

CREATE TABLE IF NOT EXISTS public.biomech_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id text,
  email text,
  survey_version text NOT NULL,
  answers jsonb NOT NULL,
  score int NOT NULL CHECK (score >= 0 AND score <= 10),
  session_count_at_submit int,
  consent_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biomech_survey_responses_owner_version_key UNIQUE (owner_key, survey_version)
);

CREATE INDEX IF NOT EXISTS biomech_survey_responses_user_id_idx
  ON public.biomech_survey_responses (user_id);

CREATE INDEX IF NOT EXISTS biomech_survey_responses_created_at_idx
  ON public.biomech_survey_responses (created_at DESC);

ALTER TABLE public.biomech_survey_responses ENABLE ROW LEVEL SECURITY;

-- Writes only via RPC; researchers export with service role / SQL editor.

CREATE OR REPLACE FUNCTION public.submit_biomech_survey(
  p_owner_key text,
  p_client_id text,
  p_email text,
  p_survey_version text,
  p_answers jsonb,
  p_score int,
  p_session_count int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
  v_id uuid;
BEGIN
  IF p_owner_key IS NULL OR length(trim(p_owner_key)) = 0 THEN
    RAISE EXCEPTION 'owner_key required';
  END IF;

  IF p_survey_version IS NULL OR length(trim(p_survey_version)) = 0 THEN
    RAISE EXCEPTION 'survey_version required';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'answers must be a json array';
  END IF;

  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'score must be between 0 and 10';
  END IF;

  IF v_user_id IS NOT NULL THEN
    IF trim(p_owner_key) <> 'user:' || v_user_id::text THEN
      RAISE EXCEPTION 'owner_key mismatch';
    END IF;
  ELSE
    IF p_client_id IS NULL OR length(trim(p_client_id)) = 0 THEN
      RAISE EXCEPTION 'client_id required for guest submissions';
    END IF;
    IF trim(p_owner_key) <> 'guest:' || trim(p_client_id) THEN
      RAISE EXCEPTION 'owner_key mismatch for guest';
    END IF;
  END IF;

  SELECT id, score INTO v_existing
  FROM public.biomech_survey_responses
  WHERE owner_key = trim(p_owner_key)
    AND survey_version = trim(p_survey_version);

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'score', v_existing.score,
      'already_submitted', true
    );
  END IF;

  INSERT INTO public.biomech_survey_responses (
    owner_key,
    user_id,
    client_id,
    email,
    survey_version,
    answers,
    score,
    session_count_at_submit
  )
  VALUES (
    trim(p_owner_key),
    v_user_id,
    CASE WHEN v_user_id IS NULL THEN trim(p_client_id) ELSE NULL END,
    NULLIF(trim(p_email), ''),
    trim(p_survey_version),
    p_answers,
    p_score,
    p_session_count
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'score', p_score,
    'already_submitted', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_biomech_survey(
  text, text, text, text, jsonb, int, int
) TO anon, authenticated;
