-- Anonymous guest registry for research (Invitado anónimo 1, 2, …)

CREATE SEQUENCE IF NOT EXISTS public.anonymous_guest_seq START 1;

CREATE TABLE IF NOT EXISTS public.anonymous_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  guest_number int NOT NULL UNIQUE DEFAULT nextval('public.anonymous_guest_seq'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.get_or_create_anonymous_guest(p_client_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number int;
BEGIN
  IF p_client_id IS NULL OR length(trim(p_client_id)) = 0 THEN
    RAISE EXCEPTION 'client_id required';
  END IF;

  SELECT guest_number INTO v_number
  FROM public.anonymous_guests
  WHERE client_id = trim(p_client_id);

  IF v_number IS NOT NULL THEN
    RETURN jsonb_build_object(
      'guest_number', v_number,
      'label', 'Invitado anónimo ' || v_number::text
    );
  END IF;

  INSERT INTO public.anonymous_guests (client_id)
  VALUES (trim(p_client_id))
  RETURNING guest_number INTO v_number;

  RETURN jsonb_build_object(
    'guest_number', v_number,
    'label', 'Invitado anónimo ' || v_number::text
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT guest_number INTO v_number
    FROM public.anonymous_guests
    WHERE client_id = trim(p_client_id);
    RETURN jsonb_build_object(
      'guest_number', v_number,
      'label', 'Invitado anónimo ' || v_number::text
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_anonymous_guest(text) TO anon, authenticated;
