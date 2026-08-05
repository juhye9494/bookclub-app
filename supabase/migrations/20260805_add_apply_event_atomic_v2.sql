CREATE OR REPLACE FUNCTION public.apply_event_atomic_v2(
  p_event_id text,
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_user_name_enc text,
  p_user_email_enc text,
  p_pii_key_version smallint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exists boolean;
  v_event record;
BEGIN
  -- Validate encrypted PII inputs
  IF p_user_name_enc IS NULL OR p_user_name_enc = '' THEN
    RAISE EXCEPTION 'p_user_name_enc cannot be empty';
  END IF;

  IF p_user_email_enc IS NULL OR p_user_email_enc = '' THEN
    RAISE EXCEPTION 'p_user_email_enc cannot be empty';
  END IF;

  IF p_pii_key_version IS NULL OR p_pii_key_version < 1 THEN
    RAISE EXCEPTION 'p_pii_key_version must be a positive integer';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'code', 'EVENT_NOT_FOUND'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.event_participants WHERE event_id = p_event_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN RETURN json_build_object('success', false, 'code', 'ALREADY_APPLIED'); END IF;

  INSERT INTO public.event_participants (
    event_id,
    user_id,
    user_email,
    user_name,
    event_title,
    user_name_enc,
    user_email_enc,
    pii_key_version
  )
  VALUES (
    p_event_id,
    p_user_id,
    p_user_email,
    p_user_name,
    v_event.title,
    p_user_name_enc,
    p_user_email_enc,
    p_pii_key_version
  );

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_event_atomic_v2(text, uuid, text, text, text, text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_event_atomic_v2(text, uuid, text, text, text, text, smallint) FROM anon;
REVOKE ALL ON FUNCTION public.apply_event_atomic_v2(text, uuid, text, text, text, text, smallint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_event_atomic_v2(text, uuid, text, text, text, text, smallint) TO service_role;
