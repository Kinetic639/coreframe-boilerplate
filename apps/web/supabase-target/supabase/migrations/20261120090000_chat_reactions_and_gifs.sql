-- =============================================================================
-- Chat: emoji reactions and GIF messages
-- =============================================================================
-- chat_messages.reactions  {"👍": ["<user id>", ...], ...} — who reacted with
--                          what. Kept on the message row, so the thread page
--                          that already loads the messages carries them and the
--                          existing "message_updated" inbox broadcast delivers
--                          every change in realtime (no extra table, query or
--                          channel).
-- chat_messages.media      a GIF picked from the GIF provider:
--                          {"kind":"gif","provider","id","url","preview_url",
--                          "width","height","title"}. The file stays on the
--                          provider's CDN (only https links to known GIF hosts
--                          are accepted); nothing is copied to storage.
-- chat_react               adds or removes the caller's reaction (idempotent,
--                          so a retried click never flips it twice).
-- chat_send                takes an optional p_media; a GIF message has no text.
-- chat_delete_message      also clears reactions and media.
-- Additive: old clients keep working (new parameter has a default).
-- =============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media     jsonb;

-- ---------------------------------------------------------------------------
-- GIF payload check (shared by chat_send)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._chat_valid_media(p_media jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p_media IS NULL OR (
    jsonb_typeof(p_media) = 'object'
    AND pg_column_size(p_media) <= 4096
    AND p_media ->> 'kind' = 'gif'
    AND coalesce(p_media ->> 'provider', '') IN ('klipy', 'giphy', 'tenor')
    AND char_length(coalesce(p_media ->> 'id', '')) BETWEEN 1 AND 200
    AND coalesce(p_media ->> 'url', '') ~
      '^https://([a-z0-9-]+\.)*(klipy\.com|klipy\.co|giphy\.com|tenor\.com)/[^\s"<>]{1,1000}$'
    AND (p_media ->> 'preview_url' IS NULL OR p_media ->> 'preview_url' ~
      '^https://([a-z0-9-]+\.)*(klipy\.com|klipy\.co|giphy\.com|tenor\.com)/[^\s"<>]{1,1000}$')
    AND jsonb_typeof(p_media -> 'width') = 'number'
    AND jsonb_typeof(p_media -> 'height') = 'number'
    AND (p_media ->> 'width')::numeric BETWEEN 1 AND 4096
    AND (p_media ->> 'height')::numeric BETWEEN 1 AND 4096
    AND char_length(coalesce(p_media ->> 'title', '')) <= 200
  );
$$;

REVOKE ALL ON FUNCTION public._chat_valid_media(jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- chat_send with an optional GIF (replaces the six-argument version)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.chat_send(uuid, text, jsonb, uuid, uuid[], jsonb);

CREATE OR REPLACE FUNCTION public.chat_send(
  p_conversation_id uuid,
  p_body_plain      text,
  p_body_rich       jsonb DEFAULT NULL,
  p_client_id       uuid DEFAULT NULL,
  p_attachment_ids  uuid[] DEFAULT '{}',
  p_mentions        jsonb DEFAULT '[]'::jsonb,
  p_media           jsonb DEFAULT NULL
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_org  uuid;
  v_body text := btrim(coalesce(p_body_plain, ''));
  v_att  uuid[] := coalesce(p_attachment_ids, '{}');
  v_msg  public.chat_messages;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.chat_conversations c
  WHERE c.id = p_conversation_id AND c.deleted_at IS NULL;

  IF v_uid IS NULL OR v_org IS NULL OR NOT public.is_chat_member(p_conversation_id) THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42501';
  END IF;

  -- Retried send (same client id): return the message already stored
  IF p_client_id IS NOT NULL THEN
    SELECT * INTO v_msg FROM public.chat_messages
    WHERE author_id = v_uid AND client_id = p_client_id;
    IF FOUND THEN
      RETURN v_msg;
    END IF;
  END IF;

  IF char_length(v_body) > 8000 OR pg_column_size(p_body_rich) > 65536 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = '22001';
  END IF;
  IF v_body = '' AND cardinality(v_att) = 0 AND p_media IS NULL THEN
    RAISE EXCEPTION 'empty message' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_att) > 10
     OR jsonb_typeof(coalesce(p_mentions, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_mentions, '[]'::jsonb)) > 50
     OR NOT public._chat_valid_media(p_media) THEN
    RAISE EXCEPTION 'invalid message' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_att) AS a(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.app_attachments t
      WHERE t.id = a.id
        AND t.org_id = v_org
        AND t.target_type = 'chat.conversation'
        AND t.target_id = p_conversation_id
        AND t.created_by = v_uid
        AND t.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'invalid attachment' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, organization_id, author_id, kind,
    body_plain, body_rich, mentions, attachment_ids, client_id, media
  )
  VALUES (
    p_conversation_id, v_org, v_uid, 'text',
    v_body, p_body_rich, coalesce(p_mentions, '[]'::jsonb), v_att, p_client_id, p_media
  )
  RETURNING * INTO v_msg;

  UPDATE public.chat_conversations
  SET last_message_at = v_msg.created_at, last_message_id = v_msg.id, updated_at = now()
  WHERE id = p_conversation_id;

  UPDATE public.chat_members
  SET last_read_at = greatest(last_read_at, v_msg.created_at), last_read_message_id = v_msg.id
  WHERE conversation_id = p_conversation_id AND user_id = v_uid;

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_send(uuid, text, jsonb, uuid, uuid[], jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_send(uuid, text, jsonb, uuid, uuid[], jsonb, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
-- p_on = true adds the caller's reaction, false removes it. Any member may react
-- to any text message that is not deleted. Limits: an emoji is 1-32 characters
-- without spaces; at most 40 different emoji on one message.
CREATE OR REPLACE FUNCTION public.chat_react(p_message_id uuid, p_emoji text, p_on boolean DEFAULT true)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_emoji text := btrim(coalesce(p_emoji, ''));
  v_msg   public.chat_messages;
  v_users jsonb;
  v_has   boolean;
BEGIN
  SELECT * INTO v_msg FROM public.chat_messages m WHERE m.id = p_message_id FOR UPDATE;
  IF v_uid IS NULL OR NOT FOUND OR v_msg.kind <> 'text' OR v_msg.deleted_at IS NOT NULL
     OR NOT public.is_chat_member(v_msg.conversation_id) THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_emoji) NOT BETWEEN 1 AND 32 OR v_emoji ~ '\s' THEN
    RAISE EXCEPTION 'invalid reaction' USING ERRCODE = '22023';
  END IF;

  v_users := coalesce(v_msg.reactions -> v_emoji, '[]'::jsonb);
  v_has := v_users @> jsonb_build_array(v_uid::text);

  IF coalesce(p_on, true) THEN
    IF v_has THEN
      RETURN v_msg;
    END IF;
    IF NOT (v_msg.reactions ? v_emoji)
       AND (SELECT count(*) FROM jsonb_object_keys(v_msg.reactions)) >= 40 THEN
      RAISE EXCEPTION 'too many reactions' USING ERRCODE = '22023';
    END IF;
    v_users := v_users || jsonb_build_array(v_uid::text);
    UPDATE public.chat_messages
    SET reactions = jsonb_set(reactions, ARRAY[v_emoji], v_users, true)
    WHERE id = p_message_id
    RETURNING * INTO v_msg;
  ELSE
    IF NOT v_has THEN
      RETURN v_msg;
    END IF;
    v_users := v_users - v_uid::text;
    UPDATE public.chat_messages
    SET reactions = CASE
      WHEN jsonb_array_length(v_users) = 0 THEN reactions - v_emoji
      ELSE jsonb_set(reactions, ARRAY[v_emoji], v_users, false)
    END
    WHERE id = p_message_id
    RETURNING * INTO v_msg;
  END IF;

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_react(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_react(uuid, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Delete also clears reactions and the GIF
-- ---------------------------------------------------------------------------
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
      mentions = '[]'::jsonb, attachment_ids = '{}', reactions = '{}'::jsonb, media = NULL
  WHERE id = p_message_id
  RETURNING * INTO v_msg;
  RETURN v_msg;
END;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: a reaction change reaches every member as "message_updated"
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS chat_messages_broadcast_update ON public.chat_messages;

CREATE TRIGGER chat_messages_broadcast_update
  AFTER UPDATE OF body_plain, body_rich, edited_at, deleted_at, reactions ON public.chat_messages
  FOR EACH ROW
  WHEN (OLD.body_plain IS DISTINCT FROM NEW.body_plain
        OR OLD.body_rich IS DISTINCT FROM NEW.body_rich
        OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
        OR OLD.reactions IS DISTINCT FROM NEW.reactions)
  EXECUTE FUNCTION public._chat_broadcast_message_update();
