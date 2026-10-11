-- =============================================================================
-- Chat: a "@" mention of a person notifies them in the bell
-- =============================================================================
-- Chat messages never go to the bell — only mentions do. chat_messages.mentions
-- holds [{ type, id }] derived from the message document by the server action.
-- A mentioned person is notified when they are an active member of the
-- conversation (so they can read the message) — also when the conversation is
-- muted: a mention is addressed to them. _notify() skips the author, checks the
-- organization membership and the recipient's notification settings.
-- Additive only: one trigger function and one trigger.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._notify_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org   uuid;
  v_kind  text;
  v_name  text;
  r       record;
BEGIN
  IF NEW.kind <> 'text' OR NEW.author_id IS NULL
     OR NEW.mentions IS NULL OR jsonb_typeof(NEW.mentions) <> 'array'
     OR jsonb_array_length(NEW.mentions) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT c.organization_id, c.kind, c.name INTO v_org, v_kind, v_name
  FROM public.chat_conversations c WHERE c.id = NEW.conversation_id;
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT m.user_id
    FROM jsonb_array_elements(NEW.mentions) AS item
    JOIN public.chat_members m
      ON m.conversation_id = NEW.conversation_id
     AND m.user_id::text = lower(item ->> 'id')
     AND m.left_at IS NULL
    WHERE item ->> 'type' = 'person'
  LOOP
    PERFORM public._notify(
      v_org, NULL, r.user_id, NEW.author_id, 'mention',
      'chat.conversation', NEW.conversation_id, NULL,
      -- Group name; empty for a 1:1 (the app shows the author instead)
      CASE WHEN v_kind = 'group' THEN coalesce(v_name, '') ELSE '' END,
      nullif(left(btrim(coalesce(NEW.body_plain, '')), 200), ''),
      jsonb_build_object('message_id', NEW.id, 'conversation_kind', v_kind),
      'chat-mention:' || NEW.id::text
    );
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_chat_mentions() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chat_messages_notify_mentions
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public._notify_chat_mentions();
