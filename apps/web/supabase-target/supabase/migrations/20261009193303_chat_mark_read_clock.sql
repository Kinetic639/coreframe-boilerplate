-- chat_mark_read: "read up to now" uses the wall clock (messages are stamped with
-- clock_timestamp(); now() is the transaction start and can be earlier)
CREATE OR REPLACE FUNCTION public.chat_mark_read(p_conversation_id uuid, p_until timestamptz DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_until timestamptz := least(coalesce(p_until, clock_timestamp()), clock_timestamp());
  v_last  uuid;
  v_at    timestamptz;
BEGIN
  IF NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_last FROM public.chat_messages
  WHERE conversation_id = p_conversation_id AND created_at <= v_until
  ORDER BY created_at DESC, id DESC LIMIT 1;

  UPDATE public.chat_members
  SET last_read_at = v_until, last_read_message_id = coalesce(v_last, last_read_message_id)
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid() AND last_read_at < v_until
  RETURNING last_read_at INTO v_at;

  RETURN coalesce(v_at, v_until);
END;
$$;
