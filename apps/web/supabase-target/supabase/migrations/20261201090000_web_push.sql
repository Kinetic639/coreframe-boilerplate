-- =============================================================================
-- Web Push: system notifications and the app icon badge on the devices where
-- a user switched them on (Konto → Powiadomienia).
--
-- push_subscriptions  one row per browser / installed app (endpoint from the
--                     browser's push service + its keys). The user sees and
--                     removes only their own; writes go through RPCs.
-- push_activity       "Ambra is open and visible on one of my screens until
--                     ..." — pinged by the app every minute; while it holds,
--                     nothing is pushed (the app already plays a sound).
-- push_queue          what is waiting to be pushed: a new notification (bell)
--                     or a new chat message. Filled by triggers, emptied by
--                     the app (`POST /api/push/dispatch`, service role).
--
-- Delivery: a statement trigger on push_queue asks the app to dispatch right
-- away through pg_net, using the Vault secrets `notifications_app_url` and
-- `notifications_cron_secret` (docs/NOTIFICATIONS_CRON_SETUP.md). Without
-- them nothing is called and the queue waits for the next dispatch.
--
-- Settings (user_preferences.notification_settings.push):
--   enabled  false switches push off on every device (default on)
--   types    events pushed; absent = _push_default_types()
-- Quiet hours apply: a push due in quiet hours is dropped (the bell keeps it).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint         text NOT NULL UNIQUE CHECK (char_length(endpoint) BETWEEN 10 AND 2000),
  p256dh           text NOT NULL CHECK (char_length(p256dh) BETWEEN 10 AND 200),
  auth             text NOT NULL CHECK (char_length(auth) BETWEEN 8 AND 100),
  user_agent       text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  standalone       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_success_at  timestamptz
);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;

CREATE TABLE public.push_activity (
  user_id       uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  active_until  timestamptz NOT NULL
);

ALTER TABLE public.push_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_activity FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_activity FROM anon, authenticated;

CREATE TABLE public.push_queue (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('notification', 'chat')),
  ref_id           uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_queue_created_idx ON public.push_queue (created_at);

ALTER TABLE public.push_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_queue FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_queue FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Settings helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_default_types()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT '["ticket.new", "ticket.assigned", "task.assigned", "task.due", "comment", "mention", "chat.new"]'::jsonb;
$$;

-- Push on for this user and this event type (settings may be NULL: defaults)
CREATE OR REPLACE FUNCTION public._push_wanted(p_settings jsonb, p_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(p_settings -> 'push' ->> 'enabled', 'true') <> 'false'
     AND (CASE WHEN jsonb_typeof(p_settings -> 'push' -> 'types') = 'array'
               THEN p_settings -> 'push' -> 'types'
               ELSE public._push_default_types() END) ? p_type;
$$;

-- ---------------------------------------------------------------------------
-- 3. Filling the queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_enqueue_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = NEW.recipient_id) THEN
    INSERT INTO public.push_queue (recipient_id, organization_id, kind, ref_id)
    VALUES (NEW.recipient_id, NEW.organization_id, 'notification', NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER notifications_push_enqueue
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._push_enqueue_notification();

CREATE OR REPLACE FUNCTION public._push_enqueue_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.kind <> 'text' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.push_queue (recipient_id, organization_id, kind, ref_id)
  SELECT m.user_id, NEW.organization_id, 'chat', NEW.id
  FROM public.chat_members m
  WHERE m.conversation_id = NEW.conversation_id
    AND m.left_at IS NULL
    AND m.user_id IS DISTINCT FROM NEW.author_id
    AND (m.muted_until IS NULL OR m.muted_until < now())
    AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = m.user_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER chat_messages_push_enqueue
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public._push_enqueue_chat_message();

-- Ask the app to send now. Never fails the insert that caused it.
CREATE OR REPLACE FUNCTION public._push_queue_kick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'notifications_app_url';
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notifications_cron_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
      RETURN NULL;
    END IF;
    PERFORM net.http_post(
      url := rtrim(v_url, '/') || '/api/push/dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch call failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER push_queue_kick
  AFTER INSERT ON public.push_queue
  FOR EACH STATEMENT EXECUTE FUNCTION public._push_queue_kick();

-- ---------------------------------------------------------------------------
-- 4. Badge: unread notifications + unread (not muted) conversations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_badge_count(p_user uuid, p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT least(
    (SELECT count(*) FROM (
       SELECT 1 FROM public.notifications n
       WHERE n.recipient_id = p_user AND n.organization_id = p_org AND n.read_at IS NULL
       LIMIT 100) x)
    + (SELECT count(*) FROM public.chat_members m
       JOIN public.chat_conversations c ON c.id = m.conversation_id AND c.deleted_at IS NULL
       WHERE m.user_id = p_user AND m.organization_id = p_org AND m.left_at IS NULL
         AND (m.muted_until IS NULL OR m.muted_until < now())
         AND c.last_message_at > m.last_read_at
         AND EXISTS (SELECT 1 FROM public.chat_messages x
                     WHERE x.conversation_id = m.conversation_id AND x.kind = 'text'
                       AND x.deleted_at IS NULL AND x.author_id IS DISTINCT FROM p_user
                       AND x.created_at > m.last_read_at)),
    99)::int;
$$;

REVOKE ALL ON FUNCTION public._push_badge_count(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Dispatch (service role): take what is due, drop what should not go
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_claim(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH taken AS (
    DELETE FROM public.push_queue q
    WHERE q.id IN (
      SELECT id FROM public.push_queue
      ORDER BY id
      LIMIT least(greatest(coalesce(p_limit, 200), 1), 500)
      FOR UPDATE SKIP LOCKED)
    RETURNING q.*
  ), due AS (
    SELECT t.*, p.notification_settings AS settings
    FROM taken t
    LEFT JOIN public.user_preferences p ON p.user_id = t.recipient_id AND p.deleted_at IS NULL
    WHERE t.created_at > now() - interval '1 hour'
      -- Ambra open and visible: the app tells the user itself
      AND NOT EXISTS (SELECT 1 FROM public.push_activity a
                      WHERE a.user_id = t.recipient_id AND a.active_until > now())
      AND NOT public._notification_in_quiet_hours(p.notification_settings)
  ), items AS (
    -- Bell notifications, still unread, of a type the user wants pushed
    SELECT d.id, d.recipient_id, d.organization_id, d.kind,
           jsonb_build_object(
             'id', n.id, 'type', n.type, 'target_type', n.target_type, 'target_id', n.target_id,
             'target_code', n.target_code, 'title', n.title, 'snippet', n.snippet,
             'data', n.data, 'created_at', n.created_at, 'read_at', n.read_at,
             'organization_id', n.organization_id,
             'actor', (SELECT jsonb_build_object('user_id', a.id, 'first_name', a.first_name,
                                                 'last_name', a.last_name, 'email', a.email)
                       FROM public.users a WHERE a.id = n.actor_id)) AS item
    FROM due d
    JOIN public.notifications n ON n.id = d.ref_id AND n.read_at IS NULL
    WHERE d.kind = 'notification' AND public._push_wanted(d.settings, n.type)
    UNION ALL
    -- Chat messages, still unread and not deleted
    SELECT d.id, d.recipient_id, d.organization_id, d.kind,
           jsonb_build_object(
             'id', x.id, 'conversation_id', c.id, 'conversation_kind', c.kind,
             'conversation_name', c.name, 'body_plain', left(x.body_plain, 300),
             'attachment_count', cardinality(x.attachment_ids),
             'gif', x.media IS NOT NULL,
             'created_at', x.created_at,
             'author', (SELECT jsonb_build_object('user_id', a.id, 'first_name', a.first_name,
                                                  'last_name', a.last_name, 'email', a.email)
                        FROM public.users a WHERE a.id = x.author_id)) AS item
    FROM due d
    JOIN public.chat_messages x ON x.id = d.ref_id AND x.deleted_at IS NULL
    JOIN public.chat_conversations c ON c.id = x.conversation_id AND c.deleted_at IS NULL
    JOIN public.chat_members m ON m.conversation_id = c.id AND m.user_id = d.recipient_id
                               AND m.left_at IS NULL AND m.last_read_at < x.created_at
                               AND (m.muted_until IS NULL OR m.muted_until < now())
    WHERE d.kind = 'chat' AND public._push_wanted(d.settings, 'chat.new')
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'queue_id', i.id, 'kind', i.kind, 'item', i.item,
    'organization_id', i.organization_id,
    'organization_name', (SELECT o.name FROM public.organizations o WHERE o.id = i.organization_id),
    'recipient', jsonb_build_object(
      'user_id', i.recipient_id,
      'locale', (SELECT p.locale FROM public.user_preferences p
                 WHERE p.user_id = i.recipient_id AND p.deleted_at IS NULL LIMIT 1)),
    'badge', public._push_badge_count(i.recipient_id, i.organization_id),
    'subscriptions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
                      FROM public.push_subscriptions s WHERE s.user_id = i.recipient_id)
  ) ORDER BY i.id), '[]'::jsonb)
  INTO v_result
  FROM items i;
  RETURN v_result;
END;
$$;

-- After sending: dead endpoints (404/410) are removed, working ones marked
CREATE OR REPLACE FUNCTION public.push_report(p_ok text[], p_gone text[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = ANY (coalesce(p_gone, '{}'));
  UPDATE public.push_subscriptions SET last_success_at = now()
  WHERE endpoint = ANY (coalesce(p_ok, '{}'));
$$;

REVOKE ALL ON FUNCTION public.push_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_report(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_report(text[], text[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. The signed-in user: devices and presence
-- ---------------------------------------------------------------------------
-- Saves this browser's subscription for the signed-in user. The endpoint
-- belongs to one browser profile: after someone else signs in there, it moves
-- to them.
CREATE OR REPLACE FUNCTION public.push_subscription_save(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL,
  p_standalone boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint !~ '^https://' THEN
    RAISE EXCEPTION 'invalid endpoint' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, standalone)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500), coalesce(p_standalone, false))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = v_uid, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent, standalone = EXCLUDED.standalone,
        last_seen_at = now(),
        created_at = CASE WHEN push_subscriptions.user_id = v_uid
                          THEN push_subscriptions.created_at ELSE now() END
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_subscription_delete(
  p_id uuid DEFAULT NULL, p_endpoint text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE user_id = auth.uid()
    AND ((p_id IS NOT NULL AND id = p_id) OR (p_endpoint IS NOT NULL AND endpoint = p_endpoint));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_subscriptions_mine()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'endpoint', s.endpoint, 'user_agent', s.user_agent, 'standalone', s.standalone,
    'created_at', s.created_at, 'last_seen_at', s.last_seen_at,
    'last_success_at', s.last_success_at) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  FROM public.push_subscriptions s
  WHERE s.user_id = auth.uid();
$$;

-- Ambra visible on a screen (p_active) or hidden / closed
CREATE OR REPLACE FUNCTION public.push_presence(p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.push_activity (user_id, active_until)
  VALUES (auth.uid(), CASE WHEN p_active THEN now() + interval '90 seconds' ELSE now() END)
  ON CONFLICT (user_id) DO UPDATE SET active_until = EXCLUDED.active_until;
END;
$$;

REVOKE ALL ON FUNCTION public.push_subscription_save(text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_subscription_delete(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_subscriptions_mine() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.push_presence(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_subscription_save(text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_subscription_delete(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_subscriptions_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_presence(boolean) TO authenticated;

REVOKE ALL ON FUNCTION public._push_default_types() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._push_wanted(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._push_enqueue_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._push_enqueue_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._push_queue_kick() FROM PUBLIC, anon, authenticated;
