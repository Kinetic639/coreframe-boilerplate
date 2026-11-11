-- =============================================================================
-- Chat: edit and delete own messages
-- =============================================================================
-- chat_edit_message   the author, within 15 minutes of sending, while still a
--                     member; sets edited_at. New mentions added by an edit do
--                     not notify (only the original message does).
-- chat_delete_message the author, any time; the row stays as a "message
--                     deleted" placeholder (text, document, mentions and
--                     attachment links are cleared).
-- Both changes reach every member's inbox channel as "message_updated" — a
-- separate event, so an edit never counts as a new unread message.
-- Additive only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.chat_edit_message(
  p_message_id uuid,
  p_body_plain text,
  p_body_rich  jsonb DEFAULT NULL,
  p_mentions   jsonb DEFAULT '[]'::jsonb
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_body text := btrim(coalesce(p_body_plain, ''));
  v_msg  public.chat_messages;
BEGIN
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.id = p_message_id FOR UPDATE;
  IF v_uid IS NULL OR NOT FOUND OR v_msg.author_id IS DISTINCT FROM v_uid
     OR v_msg.kind <> 'text' OR v_msg.deleted_at IS NOT NULL
     OR NOT public.is_chat_member(v_msg.conversation_id) THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = '42501';
  END IF;
  IF v_msg.created_at < clock_timestamp() - interval '15 minutes' THEN
    RAISE EXCEPTION 'edit window closed' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) > 8000 OR pg_column_size(p_body_rich) > 65536 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = '22001';
  END IF;
  IF (v_body = '' AND cardinality(v_msg.attachment_ids) = 0)
     OR jsonb_typeof(coalesce(p_mentions, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_mentions, '[]'::jsonb)) > 50 THEN
    RAISE EXCEPTION 'invalid message' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_messages
  SET body_plain = v_body, body_rich = p_body_rich,
      mentions = coalesce(p_mentions, '[]'::jsonb), edited_at = clock_timestamp()
  WHERE id = p_message_id
  RETURNING * INTO v_msg;
  RETURN v_msg;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_delete_message(p_message_id uuid)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.chat_messages;
BEGIN
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.id = p_message_id FOR UPDATE;
  IF v_uid IS NULL OR NOT FOUND OR v_msg.author_id IS DISTINCT FROM v_uid
     OR v_msg.kind <> 'text' OR NOT public.is_chat_member(v_msg.conversation_id) THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = '42501';
  END IF;
  IF v_msg.deleted_at IS NOT NULL THEN
    RETURN v_msg;
  END IF;

  UPDATE public.chat_messages
  SET deleted_at = clock_timestamp(), body_plain = '', body_rich = NULL,
      mentions = '[]'::jsonb, attachment_ids = '{}'
  WHERE id = p_message_id
  RETURNING * INTO v_msg;
  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_edit_message(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_delete_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_edit_message(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_delete_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._chat_broadcast_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', 'message_updated',
    'conversation_id', NEW.conversation_id,
    'message', to_jsonb(NEW) - 'organization_id'
  );
  FOR r IN
    SELECT user_id FROM public.chat_members
    WHERE conversation_id = NEW.conversation_id AND left_at IS NULL
  LOOP
    PERFORM realtime.send(v_payload, 'chat', 'user:' || r.user_id::text || ':inbox', true);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._chat_broadcast_message_update() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chat_messages_broadcast_update
  AFTER UPDATE OF body_plain, body_rich, edited_at, deleted_at ON public.chat_messages
  FOR EACH ROW
  WHEN (OLD.body_plain IS DISTINCT FROM NEW.body_plain
        OR OLD.body_rich IS DISTINCT FROM NEW.body_rich
        OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION public._chat_broadcast_message_update();
