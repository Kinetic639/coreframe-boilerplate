-- =============================================================================
-- Chat: no live read receipts in large groups (realtime cost)
-- =============================================================================
-- A read receipt was sent to every other member on each read: in a group of N
-- people one message produced about N² realtime messages. Live receipts now go
-- out only in conversations of up to 15 active members; bigger groups show them
-- when the conversation is opened (chat_get_conversation carries last_read_at).
-- Same function as in 20261009193050_chat_foundation.sql plus the size check.
-- See docs/MESSAGES_REALTIME_NOTES.md §5.2. Additive only (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE FUNCTION public._chat_broadcast_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
BEGIN
  -- Read receipts live only in conversations of up to 15 people: in a bigger group
  -- every read would be sent to everyone (cost grows with the square of the size).
  -- There the receipts are loaded with the conversation (chat_get_conversation).
  IF TG_OP = 'UPDATE' AND NEW.last_read_at IS DISTINCT FROM OLD.last_read_at AND NEW.left_at IS NULL
     AND (SELECT count(*) FROM public.chat_members m
          WHERE m.conversation_id = NEW.conversation_id AND m.left_at IS NULL) <= 15 THEN
    FOR r IN
      SELECT user_id FROM public.chat_members
      WHERE conversation_id = NEW.conversation_id AND left_at IS NULL AND user_id <> NEW.user_id
    LOOP
      PERFORM realtime.send(
        jsonb_build_object('type', 'read', 'conversation_id', NEW.conversation_id,
                           'user_id', NEW.user_id, 'last_read_at', NEW.last_read_at),
        'chat', 'user:' || r.user_id::text || ':inbox', true);
    END LOOP;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.left_at IS DISTINCT FROM OLD.left_at) THEN
    PERFORM realtime.send(
      jsonb_build_object('type', 'membership', 'conversation_id', NEW.conversation_id,
                         'active', NEW.left_at IS NULL),
      'chat', 'user:' || NEW.user_id::text || ':inbox', true);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._chat_broadcast_member() FROM PUBLIC, anon, authenticated;
