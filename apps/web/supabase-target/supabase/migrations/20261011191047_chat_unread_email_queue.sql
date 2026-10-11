-- =============================================================================
-- Chat: e-mail about unread messages (M5)
-- =============================================================================
-- The cron endpoint (service role) claims members who have a message from
-- someone else that is still unread 15 minutes after it was sent — which in
-- practice means the person is not at the app — and sends one e-mail per
-- person. One e-mail per unread streak: nothing more until they read
-- (chat_members.last_emailed_at vs last_read_at). Muted conversations, the
-- user's e-mail settings ("chat.message", on by default) and quiet hours are
-- respected; conversations silent for 36 hours are skipped.
-- Additive only.
-- =============================================================================

ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;

-- Keep in sync with DEFAULT_EMAIL_TYPES in apps/web/src/lib/notifications/settings.ts
CREATE OR REPLACE FUNCTION public._notification_email_default_types()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT '["ticket.new", "ticket.assigned", "task.assigned", "mention", "chat.message"]'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.chat_email_claim(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH due AS (
    SELECT m.conversation_id, m.user_id, m.last_read_at
    FROM public.chat_members m
    JOIN public.chat_conversations c ON c.id = m.conversation_id AND c.deleted_at IS NULL
    JOIN public.users u ON u.id = m.user_id AND u.deleted_at IS NULL
    LEFT JOIN public.user_preferences p ON p.user_id = m.user_id AND p.deleted_at IS NULL
    WHERE m.left_at IS NULL
      AND (m.muted_until IS NULL OR m.muted_until < now())
      -- One e-mail per unread streak: nothing more until the person reads
      AND (m.last_emailed_at IS NULL OR m.last_emailed_at < m.last_read_at)
      AND c.last_message_at > m.last_read_at
      AND c.last_message_at > now() - interval '36 hours'
      AND nullif(btrim(u.email), '') IS NOT NULL
      AND coalesce(p.notification_settings -> 'email' ->> 'enabled', 'true') <> 'false'
      AND (CASE WHEN jsonb_typeof(p.notification_settings -> 'email' -> 'types') = 'array'
                THEN p.notification_settings -> 'email' -> 'types'
                ELSE public._notification_email_default_types() END) ? 'chat.message'
      AND NOT public._notification_in_quiet_hours(p.notification_settings)
      AND EXISTS (
        SELECT 1 FROM public.chat_messages x
        WHERE x.conversation_id = m.conversation_id
          AND x.kind = 'text' AND x.deleted_at IS NULL
          AND x.author_id IS DISTINCT FROM m.user_id
          AND x.created_at > m.last_read_at
          AND x.created_at <= now() - interval '15 minutes'
      )
    ORDER BY c.last_message_at
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
    FOR UPDATE OF m SKIP LOCKED
  ), claimed AS (
    UPDATE public.chat_members m
    SET last_emailed_at = now()
    FROM due
    WHERE m.conversation_id = due.conversation_id AND m.user_id = due.user_id
    RETURNING m.conversation_id, m.user_id, due.last_read_at
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'conversation_id', c.id, 'organization_id', c.organization_id,
    'organization_name', (SELECT o.name FROM public.organizations o WHERE o.id = c.organization_id),
    'kind', c.kind, 'name', c.name,
    'unread_count', (SELECT count(*) FROM public.chat_messages x
                     WHERE x.conversation_id = c.id AND x.kind = 'text' AND x.deleted_at IS NULL
                       AND x.author_id IS DISTINCT FROM cl.user_id AND x.created_at > cl.last_read_at),
    'last_message', (SELECT jsonb_build_object(
                       'body_plain', left(x.body_plain, 200),
                       'attachment_count', cardinality(x.attachment_ids),
                       'created_at', x.created_at,
                       'author', (SELECT jsonb_build_object('user_id', a.id, 'first_name', a.first_name,
                                                            'last_name', a.last_name, 'email', a.email)
                                  FROM public.users a WHERE a.id = x.author_id))
                     FROM public.chat_messages x
                     WHERE x.conversation_id = c.id AND x.kind = 'text' AND x.deleted_at IS NULL
                       AND x.author_id IS DISTINCT FROM cl.user_id AND x.created_at > cl.last_read_at
                     ORDER BY x.created_at DESC LIMIT 1),
    'recipient', (SELECT jsonb_build_object(
                    'user_id', u.id, 'email', u.email, 'first_name', u.first_name,
                    'locale', (SELECT p.locale FROM public.user_preferences p
                               WHERE p.user_id = u.id AND p.deleted_at IS NULL LIMIT 1))
                  FROM public.users u WHERE u.id = cl.user_id)
  )), '[]'::jsonb)
  INTO v_result
  FROM claimed cl
  JOIN public.chat_conversations c ON c.id = cl.conversation_id;
  RETURN v_result;
END;
$$;

-- A failed send frees the conversation for the next run
CREATE OR REPLACE FUNCTION public.chat_email_release(p_user uuid, p_conversation_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.chat_members m
  SET last_emailed_at = NULL
  WHERE m.user_id = p_user AND m.conversation_id = ANY (p_conversation_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_email_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_email_release(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_email_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_email_release(uuid, uuid[]) TO service_role;
